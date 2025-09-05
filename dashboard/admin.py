from django.contrib import admin
from .models import Account, CryptoAddress, GsmService, GsmSim

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = [field.name for field in Account._meta.fields]
    search_fields = ('_id', 'accountId', 'firstName', 'lastName')
    list_filter = ('isActive', 'isAdmin', 'isPartner')
    ordering = ('-createdAt',)

@admin.register(CryptoAddress)
class CryptoAddressAdmin(admin.ModelAdmin):
    list_display = [field.name for field in CryptoAddress._meta.fields]
    search_fields = ('value', 'type')

@admin.register(GsmService)
class GsmServiceAdmin(admin.ModelAdmin):
    list_display = [field.name for field in GsmService._meta.fields]
    search_fields = ('value', 'type')


@admin.register(GsmSim)
class GsmSimAdmin(admin.ModelAdmin):
    list_display = [field.name for field in GsmSim._meta.fields]
    search_fields = ('value', 'type')