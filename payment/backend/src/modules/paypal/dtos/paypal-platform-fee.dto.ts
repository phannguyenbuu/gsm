import { PaypalMoneyDto, PaypalPayeeBaseDto } from '../dtos';


export class PaypalPlatformFeeDto {
  amount: PaypalMoneyDto;
  payee: PaypalPayeeBaseDto;
}