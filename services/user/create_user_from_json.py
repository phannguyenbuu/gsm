import json
import requests
from datetime import datetime

vps = '31.97.76.62'
API_URL = f'http://{vps}:5005/users'


def parse_iso8601(date_str):
    # Đơn giản convert str ISO8601 (có thể mở rộng)
    return datetime.fromisoformat(date_str.replace('Z', '+00:00'))

def user_to_full_payload(user):
    def get_attr(obj, attr, default=None):
        # Hàm helper lấy thuộc tính nếu là object, hoặc lấy key nếu là dict
        if isinstance(obj, dict):
            return obj.get(attr, default)
        else:
            return getattr(obj, attr, default)

    def safe_or_empty(obj, attr, default_empty):
        val = get_attr(obj, attr)
        if val is None:
            return default_empty
        return  json.dumps(val)

    
    def datetime_to_iso(dt):
        if dt is None:
            return None
        if isinstance(dt, dict) and "$date" in dt:
            # Nếu là dict kiểu {"$date": "..."} lấy giá trị chuỗi
            return dt["$date"]
        if isinstance(dt, str):
            # Có thể kiểm tra string iso hoặc giữ nguyên
            try:
                # Chuyển sang datetime rồi chuyển lại isoformat cho chuẩn
                dt_obj = datetime.fromisoformat(dt.replace('Z', '+00:00'))
                return dt_obj.isoformat()
            except Exception:
                return dt  # nếu lỗi parse, giữ nguyên string
        if isinstance(dt, datetime):
            return dt.isoformat()
        # Trường hợp khác trả về None hoặc chuỗi rỗng
        return None
    
    first_name = get_attr(user, 'firstName')
    last_name = get_attr(user, 'lastName')

    payload = {
        'accountId': get_attr(user, '_id'),
        # Các trường bắt buộc/quan trọng
        'username': first_name + ' ' + last_name,

        # Thông tin cá nhân
        'first_name': get_attr(user, 'firstName'),
        'last_name': get_attr(user, 'lastName'),
        'locale_code': get_attr(user, 'localeCode', 'en'),

        # Tài chính, quyền hạn
        'balanceAmount': get_attr(user, 'balanceAmount', 0.0) or 0.0,
        'api_key': get_attr(user, 'apiKey'),
        'is_dev': get_attr(user, 'isDev', False),
        'is_admin': get_attr(user, 'isAdmin', False),
        'is_partner': get_attr(user, 'isPartner', False),
        'trc20_address': get_attr(user, 'TRC20Address'),
        'is_active': get_attr(user, 'isActive', True),
        'permission': safe_or_empty(user, 'permission', ''),

        # Thời gian tạo và cập nhật
        'created_at': safe_or_empty(user, 'createdAt', ''),
        'updated_at':safe_or_empty(user, 'updatedAt', ''),

        # Mở rộng khác
        'webhook': get_attr(user, 'webhook'),
        'bonusChargeRate': get_attr(user, 'bonusChargeRate', 0),
        'discountRate': get_attr(user, 'discountRate', 0),
        'referral_id': get_attr(user, 'referralId', 0),
        'language_code': get_attr(user, 'languageCode', 'en'),

        'specialEvents':  safe_or_empty(user, 'specialEvents', ''),
        'partnerId': get_attr(user, 'partnerId', 0),
        'is_agent': get_attr(user, 'isAgent', False),
        'platform': get_attr(user, 'platform'),

        'serviceDiscount': safe_or_empty(user, 'serviceDiscount', ''),

        'specialRole': get_attr(user, 'specialRole', 0),
        'referralBalance': get_attr(user, 'referralBalance', 0.0),

        'telegramInfo': safe_or_empty(user, 'telegramInfo', ''),
        'orderWebhook': get_attr(user, 'orderWebhook', ''),

        'selectedServices': safe_or_empty(user, 'selectedServices', ''),

        'referralRate': get_attr(user, 'referralRate', 0),
        'referralCode': get_attr(user, 'referralCode'),

        'webInfo': safe_or_empty(user, 'webInfo', ''),

        'cryptoAddressList': safe_or_empty(user, 'cryptoAddressList', ''),

        'selectedProvider': safe_or_empty(user, 'selectedProvider', ''),
    }
    # print(payload)
    return payload


def create_user_from_data(user_data, parent_username=None):
    # Chuyển đổi dữ liệu json sang định dạng API POST /users cần nhận
    payload = user_to_full_payload(user_data)
    if parent_username:
        payload['parent_username'] = parent_username
    else:
        payload['parent_username'] = 'None'  # user cấp cao nhất

    headers = {'Content-Type': 'application/json'}

    response = requests.post(API_URL, json=payload, headers=headers)
    if response.status_code in [200, 201]:
        print(f"Created user {payload['accountId']}")
    else:
        print(f"Error creating user {payload['username']}: {response.status_code} - {response.text}")

def main():
    with open(r'D:\html\home\json\users.json', 'r', encoding='utf-8') as f:
        users = json.load(f)

    # Nếu bạn có logic tầng cấp user, bạn có thể cung cấp parent_username từng user cụ thể
    # Ví dụ tạo toàn bộ user cấp cao nhất trước hoặc set parent_username tương ứng.
    # Ở đây ví dụ đơn giản là không có parent, đều là user cấp cao nhất

    response = requests.delete(f'http://{vps}:5005/users/clear_all')
    if response.status_code == 200:
        print("Clear all users successfully:", response.json())
    else:
        print("Failed to clear:", response.text)

    for user in users:
        create_user_from_data(user, parent_username=None)

if __name__ == '__main__':
    main()
