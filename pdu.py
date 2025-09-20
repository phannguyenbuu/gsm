from datetime import datetime, timedelta, timezone

def encode_phone_number(number: str) -> str:
    number = number.lstrip('+')
    if len(number) % 2 != 0:
        number += 'F'
    return ''.join([number[i + 1] + number[i] for i in range(0, len(number), 2)])


def encode_ucs2_message(message: str) -> str:
    return message.encode('utf-16-be').hex().upper()


def create_pdu_message(smsc_number: str, recipient: str, message: str):
    # === SMSC ===
    smsc_number = smsc_number.lstrip('+')
    smsc_encoded = encode_phone_number(smsc_number)
    smsc_length = int(len(smsc_encoded) / 2 + 1)  # +1 for TON/NPI byte
    smsc = '00'

    # === Recipient ===
    recipient_digits = recipient.lstrip('+')
    recipient_len = f'{len(recipient_digits):02X}'
    recipient_encoded = encode_phone_number(recipient_digits)

    # === Message ===
    user_data = encode_ucs2_message(message)
    user_data_len = f'{int(len(user_data) / 2):02X}'  # UCS2 = 2 bytes per char

    # === PDU HEADER ===
    pdu_type = '11'              # SMS-SUBMIT
    message_ref = '00'
    recipient_type = '91'        # international
    protocol_id = '00'
    data_coding_scheme = '08'    # UCS2
    validity_period = 'AA'       # 4 days

    pdu = (
        smsc +
        pdu_type +
        message_ref +
        recipient_len +
        recipient_type +
        recipient_encoded +
        protocol_id +
        data_coding_scheme +
        validity_period +
        user_data_len +
        user_data
    )

    # Length excludes SMSC part
    length_in_bytes = (len(pdu) - len(smsc)) // 2

    return pdu, length_in_bytes



def swap_nibbles(byte):
    return ((byte & 0x0F) << 4) | ((byte & 0xF0) >> 4)

def decode_semi_octet(number_bytes, length):
    # Mỗi byte swap nibble (tách 2 số mỗi byte)
    digits = []
    for b in number_bytes:
        low = b & 0x0F
        high = (b & 0xF0) >> 4
        digits.append(str(low))
        digits.append(str(high))
    # Cắt đúng length, loại bỏ padding 'F' nếu có
    result = ''.join(digits)[:length]
    return result.replace('F','')

def decode_timestamp(ts_bytes):
    # Mỗi byte swap nibble rồi lấy như số
    swapped = [swap_nibbles(b) for b in ts_bytes]
    # ts format: YY MM DD HH mm ss TZ
    year = swapped[0]
    month = swapped[1]
    day = swapped[2]
    hour = swapped[3]
    minute = swapped[4]
    second = swapped[5]
    
    # Năm tính từ 2000 trở đi, nếu năm < 70 thì +2000, ngược lại +1900 (theo chuẩn GSM)
    year += 2000 if year < 70 else 1900
        
    return [year, month, day, hour, minute, second]
    
def gsm7bit_decode(data, length):
    # Giải mã 7-bit packed data (chỉ lấy length ký tự)
    # data: bytes giải mã phần user data
    bits = 0
    carry = 0
    septets = []
    for i in range(length):
        bit_offset = (i * 7) % 8
        byte_pos = (i * 7) // 8
        if byte_pos + 1 < len(data):
            septet = ((data[byte_pos] >> bit_offset) | (data[byte_pos+1] << (8 - bit_offset))) & 0x7F
        else:
            septet = (data[byte_pos] >> bit_offset) & 0x7F
        septets.append(septet)
    # Chuyển septets thành string theo bảng GSM 7-bit (ở đây giả sử ASCII)
    text = ''.join(chr(c) for c in septets)
    return text

def parse_pdu(pdu_string):
    pdu = bytes.fromhex(pdu_string)
    
    # SMSC info length
    smsc_len = pdu[0]
    smsc_end = 1 + smsc_len
    
    # Skip SMSC info
    # First octet
    first_octet = pdu[smsc_end]
    
    # Độ dài số gửi (sender length)
    sender_len = pdu[smsc_end + 1]
    
    # Type-of-address sender
    toa = pdu[smsc_end + 2]
    
    # Số gửi (semi octet), dài bao nhiêu byte? sender_len (bằng số nibbles)
    sender_len_bytes = (sender_len + 1) // 2
    
    sender_number_bytes = pdu[smsc_end+3 : smsc_end+3 + sender_len_bytes]
    sender_number = decode_semi_octet(sender_number_bytes, sender_len)
    # Nếu toa có bit 0x90, thêm dấu +
    if (toa & 0xF0) == 0x90:
        sender_number = "+" + sender_number
    
    # PID và DCS
    pid = pdu[smsc_end+3 + sender_len_bytes]
    dcs = pdu[smsc_end+4 + sender_len_bytes]
    
    # Timestamp
    ts_start = smsc_end + 5 + sender_len_bytes
    ts_bytes = pdu[ts_start : ts_start+7]
    timestamp = decode_timestamp(ts_bytes)
    
    # User data length
    user_data_len = pdu[ts_start + 7]
    
    # User data (bắt đầu sau user_data_len)
    user_data_start = ts_start + 8
    user_data = pdu[user_data_start : user_data_start + user_data_len]
    
    # Giải mã nội dung user data theo DCS
    # DCS = 0x00 giả định 7bit GSM default alphabet
    if dcs == 0x00:
        text = gsm7bit_decode(user_data, user_data_len)
    elif dcs == 0x08:
        try:
            text = user_data.decode("utf-16-be")
        except Exception as e:
            text = f"[Lỗi UCS2: {e}]"
    else:
        text = user_data.hex()
    
    return {
        "sender": sender_number,
        "timestamp": timestamp,
        "message": text
    }


if __name__ == "__main__":
    # PDU bạn cung cấp
    pdu_input = "0891180945123451F4040B808010861331F70000528040302270630CC8329BFD065DDF72363904"

    result = parse_pdu(pdu_input)
    print("Sender:", result["sender"])
    print("Timestamp:", result["timestamp"])
    print("Message:", result["message"])
