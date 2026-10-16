import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import CustomerRecordView from '../components/customer/CustomerRecordView';

/** An account (a customer company): Zoho-style properties, overview and tabs. */
const AgentAccountDetail: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<{ name: string; domain?: string } | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiService.getCompany(accountId!);
      setAccount(res.company || res.data || res);
    } catch {
      setMissing(true);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) load();
  }, [accountId, load]);

  if (missing) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Account not found</p>
          <button
            onClick={() => navigate('/agent/accounts')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to accounts
          </button>
        </div>
      </div>
    );
  }
  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <CustomerRecordView
      module="accounts"
      id={accountId!}
      name={account.name}
      subtitle={account.domain ? <span>{account.domain}</span> : undefined}
      backTo="/agent/accounts"
      backLabel="Back to accounts"
      addTicketHref="/agent/tickets/create?tab=ticket"
      onSaved={load}
    />
  );
};

export default AgentAccountDetail;
