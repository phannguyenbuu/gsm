import random
import math

def is_ascii(s: str) -> bool:
    return all(ord(c) < 128 for c in s)

def chunk_string(s: str, length: int):
    return [s[i:i+length] for i in range(0, len(s), length)]

def encode_number(number: str) -> str:
    number = number.lstrip('+')
    if len(number) % 2:
        number += 'F'
    return ''.join([number[i+1] + number[i] for i in range(0, len(number), 2)])

def encode_7bit_gsm(message: str) -> str:
    packed = bytearray()
    carry = 0
    carry_bits = 0

    for char in message:
        b = ord(char) & 0x7F
        b = (b << carry_bits) & 0xFF
        b |= carry
        packed.append(b)
        carry = ord(char) >> (7 - carry_bits)
        carry_bits += 1
        if carry_bits == 7:
            packed.append(carry)
            carry = 0
            carry_bits = 0
    if carry_bits > 0:
        packed.append(carry)
    return packed.hex().upper()

def encode_ucs2(message: str) -> str:
    return message.encode("utf-16-be").hex().upper()

def create_udh(ref_num: int, total: int, part: int) -> str:
    return f'050003{ref_num:02X}{total:02X}{part:02X}'

def string_to_pdu(message: str, receiver: str, dcs: int, multipart=False, total_parts=1, part_no=1, ref_num=None) -> str:
    smsc_info_length = "00"  # modem will use default SMSC
    first_octet = "01" if not multipart else "41"  # SMS-SUBMIT (with UDH if multipart)
    mr = "00"  # Message Reference

    number = receiver.lstrip('+')
    number_length = "{:02X}".format(len(number))
    type_of_address = "91" if receiver.startswith("+") else "81"
    encoded_number = encode_number(number)

    pid = "00"
    dcs_hex = "08" if dcs == 16 else "00"  # ✅ Correct DCS: 08 for UCS2, 00 for GSM 7-bit
    vp = "AA"  # Validity Period (4 days)

    if dcs == 16:
        encoded_message = encode_ucs2(message)
    else:
        encoded_message = encode_7bit_gsm(message)

    if multipart:
        if ref_num is None:
            ref_num = random.randint(0, 255)
            
        udh = create_udh(ref_num, total_parts, part_no)
        udh_len_bytes = len(udh) // 2
        full_data = udh + encoded_message

        if dcs == 16:
            udh_len_bytes = len(udh) // 2
            full_data = udh + encoded_message
            udl = "{:02X}".format(udh_len_bytes + len(encoded_message) // 2)
        else:
            septet_count = math.ceil(len(message) * 7 / 8)
            udl = "{:02X}".format(udh_len_bytes + septet_count)
    else:
        full_data = encoded_message
        udl = "{:02X}".format(len(bytes.fromhex(encoded_message)))

    return (
        smsc_info_length + first_octet + mr +
        number_length + type_of_address + encoded_number +
        pid + dcs_hex + vp + udl + full_data
    )

def build_pdu_list(message: str, receiver: str):
    is_ascii_flag = is_ascii(message)
    dcs = 7 if is_ascii_flag else 16
    max_len = 160 if is_ascii_flag else 70
    udh_reserved = 7
    ref_num = random.randint(0, 255)

    chunks = chunk_string(message, max_len - (udh_reserved if len(message) > max_len else 0))

    pdus = []
    for i, chunk in enumerate(chunks):
        pdu = string_to_pdu(
            message=chunk,
            receiver=receiver,
            dcs=dcs,
            multipart=(len(chunks) > 1),
            total_parts=len(chunks),
            part_no=i + 1,
            ref_num=ref_num
        )
        pdus.append(pdu)
    return pdus
