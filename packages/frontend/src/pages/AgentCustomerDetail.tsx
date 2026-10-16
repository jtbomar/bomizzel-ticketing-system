import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { PortalAccessCard } from '../components/PortalAccess';
import CustomerRecordView from '../components/customer/CustomerRecordView';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
}

/** A contact: Zoho-style properties, overview and tabs, plus their portal access. */
const AgentCustomerDetail: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  // Their accounts in this help desk (not companies elsewhere on Bomizzel)
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, people] = await Promise.all([
        apiService.getUserDetails(customerId!),
        apiService.getRecordPart('contacts', customerId!, 'people'),
      ]);
      setContact(res.user || res);
      setAccounts(people.accounts || []);
    } catch {
      setMissing(true);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) load();
  }, [customerId, load]);

  if (missing) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Contact not found</p>
          <button
            onClick={() => navigate('/agent/customers')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to contacts
          </button>
        </div>
      </div>
    );
  }
  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email;

  return (
    <CustomerRecordView
      module="contacts"
      id={customerId!}
      name={name}
      subtitle={
        <>
          {accounts.map((c, i) => (
            <React.Fragment key={c.id}>
              {i > 0 && <span>·</span>}
              <Link to={`/agent/accounts/${c.id}`} className="hover:underline">
                {c.name}
              </Link>
            </React.Fragment>
          ))}
          {accounts.length > 0 && <span>·</span>}
          <span>{contact.email}</span>
          {!contact.isActive && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Inactive
            </span>
          )}
        </>
      }
      backTo="/agent/customers"
      backLabel="Back to contacts"
      addTicketHref={`/agent/tickets/create?tab=ticket&customerId=${encodeURIComponent(customerId!)}`}
      sidebarExtra={<PortalAccessCard contactId={customerId!} onChanged={load} />}
      onSaved={load}
    />
  );
};

export default AgentCustomerDetail;
