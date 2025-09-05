import PayPalPayment from '@/components/PayPalPayment';
import PayPalDashboard from '@/components/PayPalDashboard';

export default function PayPalPage() {
    return (
        <div>
            <PayPalPayment />
            <PayPalDashboard />
        </div>
    )
}