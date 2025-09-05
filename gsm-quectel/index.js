const express = require('express');
const axios = require('axios')
const app = express();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const http = require('http').Server(app);
const https = require('https');
const { query, body, validationResult } = require('express-validator')
const { io } = require("socket.io-client")
const { execSync } = require('child_process');
const crypto = require('crypto');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const FormData = require('form-data');
const serverHost = "http://verifysms.org"
const socket = io(serverHost, {
    rejectUnauthorized: false,
    autoConnect: false,
});
const port = 9000;
const computerHomeDir = process.env.HOME || process.env.USERPROFILE;
const recordFolder = path.join(computerHomeDir, 'Documents', 'WYT', 'dangsmodem', 'dangsmodem', 'Voices');

dayjs.extend(utc);
dayjs.extend(timezone);

app.use(cors("*"));
app.use(express.json());

function getCpuId() {
    try {
        const stdout = execSync('wmic cpu get ProcessorId').toString();
        const lines = stdout.trim().split('\n');
        return lines[1]?.trim() || '';
    } catch (err) {
        console.error('Error getting CPU ID:', err);
        return '';
    }
}
  
function getHardDriveId() {
    try {
        const stdout = execSync('wmic diskdrive get SerialNumber').toString();
        const lines = stdout.trim().split('\n');
        return lines[1]?.trim().replace(/[._]/g, '') || '';
    } catch (err) {
        console.error('Error getting Hard Drive ID:', err);
        return '';
    }
}
  
const cpuId = getCpuId();
const hardDriveId = getHardDriveId();
const hardwareId = `NT${cpuId}${hardDriveId}`;
  
// console.log(`CPU ID:`, cpuId);
// console.log(`Hard Drive ID:`, hardDriveId);
console.log(`Hardware ID:`, hardwareId);
console.log(`Records' folder:`, recordFolder);

socket.on("connect", () => {
    socket.hwid = hardwareId;
    socket.emit("joinHardwareId", hardwareId);
    console.log(`\x1b[32mSocket connected!\x1b[0m`);
});

socket.on("disconnect", () => {
    console.log(`\x1b[31mSocket disconnected!\x1b[0m`);
});

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
}

app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

function getFile(filename, filePath, res) {
    res.sendFile(filePath, (err) => {
        if (err) {
            res.status(404).send('404 Not Found');
        }
    });
}

const rootFolder = __dirname;

app.get('/.well-known/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = `${rootFolder}/.well-known/${filename}`;

    getFile(filename, filePath, res);
});

app.get('/.well-known/acme-challenge/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = `${rootFolder}/.well-known/acme-challenge/${filename}`;

    getFile(filename, filePath, res);
});

let portList = [];
let tmpPortList = [];
let smsList = [];
let tmpSmsList = [];
let recordFileList = [];
let isGsmConnected = false;
let isSocketConnected = false;
let currentConnectStateMes = "";

/**
 * Gửi file qua POST (multipart/form-data)
 * @param {Buffer} fileBuffer - Buffer chứa nội dung file
 * @param {string} uploadUrl - URL nhận file
 * @param {string} originalFilePath - Đường dẫn gốc để lấy tên file nếu customName không có
 * @param {string} customName - Tên file muốn gửi (tuỳ chọn). Nếu không có sẽ lấy tên từ originalFilePath
 * @returns {Promise<string>} - Nội dung phản hồi từ server
 */
async function sendFileAPI(fileBuffer, uploadUrl, originalFilePath, customName = '') {
    try {
        const fileNameToSend = customName !== '' ? customName : path.basename(originalFilePath);

        const form = new FormData();
        form.append('file', fileBuffer, {
            filename: fileNameToSend,
            contentType: 'audio/wav' // có thể tùy chỉnh theo file
        });

        const response = await axios.post(uploadUrl, form, {
            headers: {
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return response.data;
    } catch (error) {
        return `An error occurred: ${error.message}`;
    }
}

function handleRecordFileName(oldFileName) {
    const match = oldFileName.match(/^([A-Z0-9]+)_(\d{17})_Voice\.wav$/);
    if (!match) {
        throw new Error("Filename format not matched");
    }

    const portName = match[1]; // e.g. COM73
    const rawTimestamp = match[2]; // e.g. 20250417083635641

    const timestamp = `${rawTimestamp.substring(0, 8)}_${rawTimestamp.substring(8, 14)}`; // e.g. 20250417_083635
    const number0 = portNameToPhoneNumber(portName);
    const direction = `incoming_from`;
    const number1 = '';
    const randomCode = generateRandomCode(50);

    const newFileName = `${timestamp}_${number0}_${direction}_${number1}_${randomCode}.wav`;
    return newFileName;
}

function handleRecordFileName1(oldFileName) {
    const match = oldFileName.match(/^([A-Z0-9]+)_(\d{17})_(\d+)_([\d]+)_Voice\.wav$/);
    if (!match) {
        throw new Error("Filename format not matched");
    }

    const rawTimestamp = match[2]; // e.g. 20250417182820421

    const timestamp = `${rawTimestamp.substring(0, 8)}_${rawTimestamp.substring(8, 14)}`; // 20250417_182820
    const number0 = '0' + match[3]; // e.g. 09071133557
    const direction = 'incoming_from';
    const number1 = match[4]; // e.g. 495471177980
    const randomCode = generateRandomCode(50);

    const newFileName = `${timestamp}_${number0}_${direction}_${number1}_${randomCode}.wav`;
    return newFileName;
}

function checkRecordFile() {
    let oldRecordFileList = recordFileList;
    recordFileList = fs.readdirSync(recordFolder)
        .filter(file => file.toLowerCase().endsWith('.wav'))
        .map(file => ({
            name: file,
            fullPath: path.join(recordFolder, file),
            mtime: fs.statSync(path.join(recordFolder, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime) // Mới nhất trước
        .slice(0, 10); // Chỉ lấy 10 file mới nhất

    let md5OldRecordFileList = arrayToMd5(oldRecordFileList)
    let md5RecordFileList = arrayToMd5(recordFileList)

    if (md5RecordFileList !== md5OldRecordFileList && oldRecordFileList.length > 0) {
        if (recordFileList && recordFileList.length > 0 && typeof recordFileList[0] !== 'undefined') {
            let latestFile = recordFileList[0];
            const filePath = latestFile.fullPath;
            const uploadUrl = `${serverHost}/api/upload`;
            const customFileName = handleRecordFileName1(latestFile.name);

            let lastestRecordInfo = {
                name: latestFile.name,
                newName: customFileName,
                fullPath: latestFile.fullPath,
                mtime: latestFile.mtime,
            };

            fs.readFile(filePath, async (err, data) => {
                if (err) {
                    lastestRecordInfo.result = `[ERROR] ` + error;
                    console.error(`\x1b[31mVoice failed to be received...\x1b[0m`, lastestRecordInfo);
                    return;
                }

                const result = await sendFileAPI(data, uploadUrl, filePath, customFileName);

                if (result == 'OK') {
                    lastestRecordInfo.result = `[SUCCESS] [sendFileAPI] ` + result;
                    console.error(`\x1b[32mVoice received successfully...\x1b[0m`, lastestRecordInfo);
                } else {
                    lastestRecordInfo.result = `[ERROR] [sendFileAPI] ` + result;
                    console.error(`\x1b[31mVoice failed to be received...\x1b[0m`, lastestRecordInfo);
                }
            });
        }
    }
}

function handleSmsList() {
    smsList = [];
    if (tmpSmsList.length > 0) {
        for (let i = 0; i < tmpSmsList.length; i++) {
            smsList[i] = {
                portName: tmpSmsList[i].Port,
                phoneNumber: tmpSmsList[i].Phone != '' ? `0${tmpSmsList[i].Phone}` : `?`,
                msgSender: tmpSmsList[i].From,
                msgSent: convertToTokyoFormat(tmpSmsList[i].Time),
                msgContent: tmpSmsList[i].Message,
                __originModemInfo: {
                    ID: tmpSmsList[i].ID,
                    Time: tmpSmsList[i].Time,
                    Port: tmpSmsList[i].Port,
                    Phone: tmpSmsList[i].Phone,
                    From: tmpSmsList[i].From,
                    Message: tmpSmsList[i].Message,
                },
            }
        }
    }
}

function handlePortList() {
    portList = [];
    if (tmpPortList.length > 0) {
        for (let i = 0; i < tmpPortList.length; i++) {
            portList[i] = {
                portName: tmpPortList[i].Port,
                imei: tmpPortList[i].Port,
                editable: false,
                key: tmpPortList[i].Port,
                busy: false,
                loading: false,
                ussdPending: false,
                phoneNumber: tmpPortList[i].Phone != '' ? `0${tmpPortList[i].Phone}` : `?`,
                balance: 0,
                message: tmpPortList[i].Phone != '' ? `Registered` : `?`,
                provider: extractProvider(tmpPortList[i].Operator),
                status: tmpPortList[i].Phone != '' ? 'SUCCESS' : 'NOT READY',
                apiLocked: false,
                checked: true,
                portAlias: tmpPortList[i].Port,
                hardwareId: hardwareId,
                __originModemInfo: {
                    Port: tmpPortList[i].Port,
                    Phone: tmpPortList[i].Phone,
                    CountryID: tmpPortList[i].CountryID,
                    Operator: tmpPortList[i].Operator,
                    IMSI: tmpPortList[i].IMSI,
                    ICCID: tmpPortList[i].ICCID,
                },
            }
        }
    }
}

/**
 * Chuyển đổi ngày từ local time (máy hiện tại) sang định dạng: 'YY/MM/DD,HH:mm:ss+09:00'
 * @param {string} inputDate - Chuỗi ngày ở định dạng 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} Chuỗi định dạng mới
 */
function convertToTokyoFormat(inputDate, format = 'YY/MM/DD,HH:mm:ssZ') {
    // Parse theo local time (giờ máy hiện tại)
    const localTime = dayjs(inputDate);

    // Chuyển sang múi giờ Asia/Tokyo (UTC+9)
    const tokyoTime = localTime.tz('Asia/Tokyo');

    // Format lại theo yêu cầu
    return tokyoTime.format(format);
}

function extractProvider(originProvider) {
    let provider = '?'
    if (originProvider.toLowerCase().includes("vietnamobile")) {
        provider = "Vietnamobile"
    } else if (originProvider.toLowerCase().includes("viettel")) {
        provider = "Viettel";
    } else if (originProvider.toLowerCase().includes("mobifone")) {
        provider = "Mobifone"
    } else if (originProvider.toLowerCase().includes("vinaphone")) {
        provider = "Vinaphone"
    } else if (originProvider.toLowerCase().includes("docomo")) {
        provider = "JP Docomo"
    }
    return provider;
}

function arrayToMd5(arr) {
    const str = JSON.stringify(arr);
    const md5 = crypto.createHash('md5').update(str).digest('hex');
    return md5;
}

function updatePortListAPI(updateChecked = false) {
    if (!hardwareId) return;

    socket.emit("portListChanged", portList);
    socket.emit("updatePortList", portList);

    // const ports = portList;

    // let portListChanged = null;

    // if (!updateChecked) {
    //     portListChanged = ports
    //         .filter((c) => c.simReady)
    //         .map((c) => {
    //             delete c.key;
    //             delete c.imei;
    //             delete c.editable;
    //             delete c.simReady;

    //             return c;
    //         });
    //     socket.emit("portListChanged", portListChanged);
    // } else {
    //     portListChanged = portList;
    //     socket.emit("updatePortList", portListChanged);
    // }
}

function cleanMessagesInRawJson(rawJson) {
    return rawJson.replace(/"Message":"([\s\S]*?)"}/g, (_, messageContent) => {
        const cleaned = messageContent
            .replace(/"/g, '') // Xoá dấu "
            .replace(/\\r?\\n|[\r\n]/g, ''); // Xoá xuống dòng (escaped hoặc thật)
        return `"Message":"${cleaned}"}`;
    });
}

async function checkSms() {
    const configCheckSmsId = {
        method: 'get',
        url: `http://localhost:11186/api.jsp?act=checkID`,
    }

    axios(configCheckSmsId)
    .then(async function (responseCheckSmsId) {
        let startId = parseInt(responseCheckSmsId.data.StartID);
        startId -= 150;
        if (startId < 0) startId = 0;

        const config = {
            method: 'get',
            url: `http://localhost:11186/api.jsp?act=getSmsList&StartID=${startId}`,
        }

        axios(config)
        .then(async function (response) {
            let jsonStr = "";

            jsonStr = response.data.toString();

            if (!jsonStr || jsonStr && !jsonStr.includes(`"Code":"1","Msg":"OK","List":`)) {
                jsonStr = JSON.stringify(response.data);
            }
            
            let smsListStr = cleanMessagesInRawJson(jsonStr);
            // console.log(smsListStr);

            let parsedSmsList = JSON.parse(smsListStr);
            // console.log(parsedSmsList);

            let oldSmsList = smsList;
            tmpSmsList = parsedSmsList.List;
            handleSmsList();

            let md5OldSmsList = arrayToMd5(oldSmsList)
            let md5SmstList = arrayToMd5(smsList)

            if (md5SmstList !== md5OldSmsList && oldSmsList.length > 0) {
                await sendMesToServer();
            }

            checkSms();
        })
        .catch((error) => {
            console.log(error);
            checkSms();
        });
    })
    .catch((error) => {
        console.log(error);
        checkSms();
    });
}

async function sendMesToServer() {
    if (tmpSmsList && tmpSmsList.length > 0 && typeof tmpSmsList[0] !== 'undefined') {
        const data = {
            source: hardwareId,
            sender: tmpSmsList[0].From,
            receiver: tmpSmsList[0].Phone != '' ? `0${tmpSmsList[0].Phone}` : `?`,
            message: tmpSmsList[0].Message,
            sent_time: convertToTokyoFormat(tmpSmsList[0].Time, "DD/MM/YYYY HH:mm:ss"),
        }

        const config = {
            method: 'post',
            url: `${serverHost}/api/sm-data`,
            data
        }

        axios(config)
        .then(() => {
            console.log(`\x1b[32mSMS received successfully...\x1b[0m`, data);
        })
        .catch((error) => {
            console.error(`\x1b[31mSMS failed to be received...\x1b[0m`, error);
        });
    }
}

async function checkGsmToolConnection() {
    const config = {
        method: 'get',
        url: `http://localhost:11186/api.jsp?act=getPortList`,
    }

    axios(config)
    .then(async function (response) {
        let oldPortList = portList;
        tmpPortList = response.data.List;
        handlePortList();

        const oldConnectStateMes = currentConnectStateMes;
        const stateMes = `\x1b[32mGSM Tool connected! Retrieving data...\x1b[0m`;

        currentConnectStateMes = stateMes;
        global.isGsmConnected = true;

        let md5OldPortList = arrayToMd5(oldPortList)
        let md5PortList = arrayToMd5(portList)

        if (md5PortList !== md5OldPortList) {
            console.log("Port List:\n", showPortList());
            updatePortListAPI(true);
        }

        if (currentConnectStateMes !== oldConnectStateMes) {
            console.log(stateMes);
        }

        if (!isSocketConnected && socket && hardwareId) {
            socket.connect();
            isSocketConnected = true;
        }

        checkRecordFile();
        checkGsmToolConnection();
    })
    .catch((error) => {
        // console.log(error);

        const oldConnectStateMes = currentConnectStateMes;
        const stateMes = `\x1b[31mGSM Tool disconnected!\x1b[0m`;

        currentConnectStateMes = stateMes;
        global.isGsmConnected = false;

        if (currentConnectStateMes !== oldConnectStateMes) {
            console.log(stateMes);
        }

        if (isSocketConnected && socket) {
            socket.disconnect();
            isSocketConnected = false;
        }

        checkGsmToolConnection();
    });
}

checkGsmToolConnection();
checkSms();

function showPortList() {
    if (portList) {
        return portList.map(item => `${item.__originModemInfo.Operator != '' ? '\x1b[32m' : '\x1b[31m'}${item.portName} - ${item.phoneNumber} - ${item.provider} (${item.__originModemInfo.Operator != '' ? item.__originModemInfo.Operator : '?'}) - ${item.status}\x1b[0m`).join("\n");
    }
    return '';
}

function portNameToPhoneNumber(portName) {
    if (tmpPortList.length > 0) {
        for (let i = 0; i < tmpPortList.length; i++) {
            if (tmpPortList[i].Port == portName) {
                return tmpPortList[i].Phone != '' ? `0${tmpPortList[i].Phone}` : `?`;
            }
        }
    }
    return null;
}

function showConsoleLog(title, index, content) {
    console.log(`\n\x1b[32m[START][${index}] ${title}\x1b[0m\n`, content, `\n\x1b[33m[END][${index}] ${title}\x1b[0m`);
}

function generateRandomCode(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
}

if (socket) {
    socket.on("APILocked", (stock) => {
        console.log(`\x1b[33mReceiving socket request...APILocked\x1b[0m`);

        const port = portList.find((c) => c.phoneNumber == stock.msisdn);

        if (port) {
            port.apiLocked = true;
        }
    });

    socket.on("requestPortList", () => {
        console.log(`\x1b[33mReceiving socket request...requestPortList\x1b[0m`);

        updatePortListAPI();
    });

    socket.on("GetSMSList", (obj) => {
        console.log(`\x1b[33mReceiving socket request...GetSMSList\x1b[0m`);

        showConsoleLog("GetSMSList", 0, { requestId: obj.requestId, data: smsList });

        socket.emit("requestCallBack", { requestId: obj.requestId, data: smsList });
    });

    socket.on("GetPortList", (obj) => {
        console.log(`\x1b[33mReceiving socket request...GetPortList\x1b[0m`);

        showConsoleLog("GetPortList", 0, { requestId: obj.requestId });

        socket.emit("requestCallBack", { requestId: obj.requestId, data: portList });
    });

    socket.on("SendSMS", (obj) => {
        console.log(`\x1b[33mReceiving socket request...SendSMS\x1b[0m`);

        showConsoleLog("SendSMS", 0, showPortList());

        const port = portList.find((c) => c.phoneNumber == obj.phoneNumber);

        if (!port && port.busy) return socket.emit("requestCallBack", { requestId: obj.requestId, data: { status: false, error: "Cannot access port" } });

        // SendSMSCommand(port, obj.data?.receiver, obj.data?.message, (status, error) => {
        //     socket.emit("requestCallBack", { requestId: obj.requestId, data: { status, error } })
        // })

        const config = {
            method: 'get',
            url: `http://localhost:11186/api.jsp?act=sendSms&Port=${port}&Receiver=${obj.data?.receiver}&Sms=${obj.data?.message}`,
        }
    
        axios(config)
        .then(function (response) {
            socket.emit("requestCallBack", { requestId: obj.requestId, data: { status: true, error: null } });
        })
        .catch((error) => {
            // console.log(error);
            socket.emit("requestCallBack", { requestId: obj.requestId, data: { status: false, error: null } });
        });
    });

    socket.on("SendUSSD", (obj) => {
        console.log(`\x1b[33mReceiving socket request...SendUSSD\x1b[0m`);

        showConsoleLog("SendUSSD", 0, showPortList());

        portList.forEach((port) => {
            if (obj.data?.ports.includes(port.portName) && port.phoneNumber != '') {
                const data = {
                    phone_number: port.phoneNumber,
                    source: hardwareId,
                    type: "new-phone-number",
                }

                const config = {
                    method: 'post',
                    url: `${serverHost}/api/sm-ussd`,
                    data
                }

                axios(config)
                .then(() => {
                    console.log(`\x1b[32mSendUSSD handled successfully...\x1b[0m`, data);
                })
                .catch((error) => {
                    console.error(`\x1b[31mSendUSSD failed to be handled...\x1b[0m`, error);
                });
            }
        });

        socket.emit("requestCallBack", { requestId: obj.requestId, data: null });
    });

    socket.on("UpdateCheckedRows", (obj) => {
        console.log(`\x1b[33mReceiving socket request...UpdateCheckedRows\x1b[0m`);

        showConsoleLog("GetPortList", 0, { requestId: obj.requestId });

        // this.portStore.checkedRows=  obj.data;
        socket.emit("requestCallBack", { requestId: obj.requestId, data: null });
    });
}

// http.listen(port, function () {
//     console.log(`\x1b[1;32mAPI is listening at *:${port}\x1b[0m`);
// });