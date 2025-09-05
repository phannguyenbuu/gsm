from django.db import models
from datetime import datetime
from django.utils import timezone
from django.core.validators import MaxValueValidator, MinValueValidator

# Hàm chuyển chuỗi ISO8601 sang datetime hoặc trả về None nếu không hợp lệ
def parse_iso_datetime(date_str):
    if date_str:
        try:
            # Thay Z bằng +00:00 để Python hiểu timezone UTC
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except ValueError:
            return None
    return None


def parse_datetime(value):
    if isinstance(value, dict) and '$date' in value:
        dt = datetime.fromisoformat(value['$date'].replace('Z', '+00:00'))
        if timezone.is_naive(dt):
            return timezone.make_aware(dt)
        return dt
    elif isinstance(value, datetime):
        if timezone.is_naive(value):
            return timezone.make_aware(value)
        return value
    return None

class Account(models.Model):
    _id = models.CharField(max_length=50, unique=True)
    accountId = models.IntegerField()
    firstName = models.CharField(max_length=50, null=True, blank=True)
    lastName = models.CharField(max_length=50, null=True, blank=True)
    localeCode = models.CharField(max_length=10, null=True, blank=True)
    balanceAmount = models.FloatField(null=True, blank=True)
    apiKey = models.CharField(max_length=100, null=True, blank=True)
    isDev = models.BooleanField(default=False)
    isAdmin = models.BooleanField(default=False)
    isPartner = models.BooleanField(default=False)
    TRC20Address = models.CharField(max_length=100, null=True, blank=True)
    isActive = models.BooleanField(default=True)
    createdAt = models.DateTimeField(null=True, blank=True)
    updatedAt = models.DateTimeField(null=True, blank=True)
    discountRate = models.FloatField(null=True, blank=True)
    bonusChargeRate = models.FloatField(null=True, blank=True)
    referralBalance = models.FloatField(null=True, blank=True)
    referralCode = models.CharField(max_length=50, null=True, blank=True)
    platform = models.CharField(max_length=50, null=True, blank=True)

    def __str__(self):
        return f"{self.firstName} {self.lastName} ({self._id})"
    


    @classmethod
    def load_json_to_db(cls, json_data):
        total = len(json_data)
        for i, item in enumerate(json_data):
            print(i, '/', total, item.get('_id'))

            # createdAt_str = item.get('createdAt', {}).get('$date') if item.get('createdAt') else None
            # updatedAt_str = item.get('updatedAt', {}).get('$date') if item.get('updatedAt') else None

            # createdAt = parse_iso_datetime(createdAt_str)
            # updatedAt = parse_iso_datetime(updatedAt_str)

            account, created = Account.objects.update_or_create(
                _id=item.get('_id'),
                defaults={
                    '_id': item.get('_id'),
                    'accountId': int(item.get('accountId')),
                    'firstName': item.get('firstName'),
                    'lastName': item.get('lastName'),
                    'localeCode': item.get('localeCode'),
                    'balanceAmount': item.get('balanceAmount'),
                    'apiKey': item.get('apiKey'),
                    'isDev': item.get('isDev', False),
                    'isAdmin': item.get('isAdmin', False),
                    'isPartner': item.get('isPartner', False),
                    'TRC20Address': item.get('TRC20Address'),
                    'isActive': item.get('isActive', True),
                    'createdAt': parse_datetime(item.get('createdAt')),
                    'updatedAt': parse_datetime(item.get('updatedAt')),
                    'discountRate': item.get('discountRate'),
                    'bonusChargeRate': item.get('bonusChargeRate'),
                    'referralBalance': item.get('referralBalance', 0.0),
                    'referralCode': item.get('referralCode'),
                    'platform': item.get('platform'),
                }
            )
            
            # Xóa địa chỉ cũ để tránh trùng lặp (tuỳ chọn)
            account.crypto_addresses.all().delete()

            crypto_addresses = item.get('cryptoAddressList', [])
            for ca in crypto_addresses:
                CryptoAddress.objects.create(
                    value=ca.get('value'),
                    type=ca.get('type'),
                    account=account
                )



class CryptoAddress(models.Model):
    value = models.CharField(max_length=128, null=True, blank=True)
    type = models.CharField(max_length=20, null=True, blank=True)
    account = models.ForeignKey(Account, related_name='crypto_addresses', on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.type}: {self.value}"


class GsmSim(models.Model):
    _id = models.CharField(max_length=50, unique=True)
    pcname = models.CharField(max_length=50)
    phonenumber = models.CharField(max_length=15)
    provider = models.CharField(max_length=50)
    port = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(255)]
    )

    def __str__(self):
        return f"{self.pcname}: {self.port}"
    
class GsmService(models.Model):
    _id = models.CharField(max_length=50, unique=True, default='', blank = True)
    
    index = models.IntegerField(default=0)
    price = models.FloatField(default=0)
    isActive = models.BooleanField(default=True)
    isPrivate = models.BooleanField(default=False)
    
    code = models.CharField(max_length=50, default='')
    text = models.CharField(max_length=50, default='')
    image = models.CharField(max_length=50, default='')
    countryCode = models.CharField(max_length=10, default='')

    supportSMS = models.BooleanField(default=True)
    supportCall = models.BooleanField(default=True)

    privatePartners = models.JSONField(default=list, blank=True, null=True)
    rentPrice = models.JSONField(default=list, blank=True, null=True)
    callCenters = models.JSONField(default=list, blank=True, null=True)

    messageOTPLimit = models.IntegerField(default=1)
    saleOffValue = models.FloatField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"GsmService {self.id}"

    @classmethod
    def load_json_to_db(cls, json_data):
        total = len(json_data)
        for i, item in enumerate(json_data):
            print(i, '/', total, item.get('_id'))

            cls.objects.update_or_create(
                _id=item.get('_id'),
                defaults={
                    
                    'index': item.get('index', 0),
                    'price': item.get('price', 0.0),
                    'isActive': item.get('isActive', False),
                    'isPrivate': item.get('isPrivate', False),
                    'privatePartners': item.get('privatePartners', []),
                    'code': item.get('code', ''),
                    'text': item.get('text', ''),
                    'image': item.get('image', ''),
                    'countryCode': item.get('countryCode', ''),

                    'supportSMS': item.get('supportFeatures', {}).get('SMSService', False),
                    'supportCall': item.get('supportFeatures', {}).get('CallService', False),

                    'rentPrice': item.get('rentDurationPrices', []),
                    'callCenters': item.get('callCenters', []),

                    'messageOTPLimit': item.get('messageLimit', 0),
                    'saleOffValue': item.get('saleOffValue', 0.0),
                }
            )
