import { useState } from 'react';
import { Payments } from './Payments';
import { CashReceipts } from './CashReceipts';
import { CreditCard, FileText } from 'lucide-react';

type Tab = 'payments' | 'receipts';

export function Transactions() {
  const [activeTab, setActiveTab] = useState<Tab>('receipts');

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b border-gray-200 pb-4">
        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'receipts'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="font-medium">Recibos y Anticipos</span>
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'payments'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="font-medium">Pagos de Motos</span>
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'receipts' ? <CashReceipts /> : <Payments />}
      </div>
    </div>
  );
}
