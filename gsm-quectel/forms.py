from django import forms
from django.http import JsonResponse
from datetime import datetime, timedelta
from django.forms.widgets import SelectMultiple
from django.forms import TextInput, MultiWidget, MultiValueField, DateInput

class TransactionFilterForm(forms.Form):
    BANK_CHOICES = [
        ('vcb', 'Vietcombank'),
        ('acb', 'ACB'),
        ('mb', 'MB Bank'),
        ('tpb', 'TPBank'),
        ('nama', 'Nam A Bank'),
        ('tech', 'Techcom Bank'),
        # Thêm các ngân hàng khác...
    ]

    bank_account = forms.ChoiceField(
        label='Ngân hàng',
        choices=BANK_CHOICES,
        required=False,
        widget=forms.Select(attrs={
            'class': 'ts-dropdown single',
        })
    )

    transaction_type = forms.ChoiceField(
        label='Loại giao dịch',
        choices=[('deposit', 'Nạp tiền'), ('withdraw', 'Rút tiền')],
        required=False
    )
    amount = forms.DecimalField(label='Số tiền', required=False, min_value=0)
    start_date = forms.DateField(label='Ngày bắt đầu', required=False, widget=forms.DateInput(attrs={'type': 'date'}))
    end_date = forms.DateField(label='Ngày kết thúc', required=False, widget=forms.DateInput(attrs={'type': 'date'}))

    
    transactions_table_length = forms.ChoiceField(
        label='Số giao dịch trên mỗi trang',
        choices=[
        (10, '10'),
        (15, '15'),
        (25, '25'),
        (50, '50'),
        (100, '100'),
        (300, '300'),
        (500, '500'),
        (1000, '1,000'),
        (2000, '2,000'),
        (5000, '5,000'),
        (7000, '7,000'),
        (9000, '9,000'),
    ],
        initial=10,
        required=False,
        widget=forms.Select(attrs={'class': 'form-select form-select-sm'})
    )
    

    type_filter = forms.ChoiceField(
        label='Lọc theo',
        choices=[
        ('id', 'ID'),
        ('account', 'Tài khoản'),
        ('value', 'Giá trị'),
    ],
        initial=10,
        required=False,
        widget=forms.Select(attrs={'class': 'form-select form-select-sm'})
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Thêm thẻ <img> vào trong bank_account field
        self.fields['bank_account'].widget.attrs.update({
            'class': 'form-control',
            'placeholder': 'Nhập ngân hàng'
        })

        # Thêm một thẻ <img> sau trường bank_account (như yêu cầu)
        self.fields['bank_account'].widget.attrs['class'] += ' with-image'  # Thêm class cho trường input nếu cần

        # Chèn ảnh vào widget của trường bank_account
        self.fields['bank_account'].help_text = '<img style="width: 20px; height: 20px" src="" alt="Your Image" />'

class ImageUploadForm(forms.Form):
    image = forms.ImageField(label='Chọn hình ảnh')
