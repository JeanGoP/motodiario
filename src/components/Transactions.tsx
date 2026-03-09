import { useState } from 'react';
import { Payments } from './Payments';
import { CashReceipts } from './CashReceipts';
import { CreditCard, FileText } from 'lucide-react';

type Tab = 'payments' | 'receipts';

export function Transactions() {
  const [activeTab, setActiveTab] = useState<Tab>('receipts');

  return (
    <div className="space-y-6">
      <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-flex">
        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-medium text-sm ${
            activeTab === 'receipts'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-900/20'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Recibos y Anticipos</span>
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-medium text-sm ${
            activeTab === 'payments'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-900/20'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Pagos de Motos</span>
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'receipts' ? <CashReceipts /> : <Payments />}
      </div>
    </div>
  );
}
