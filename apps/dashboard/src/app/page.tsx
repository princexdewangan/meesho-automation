'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  ListOrdered,
  AlertTriangle,
  Settings as SettingsIcon,
  Terminal,
  RefreshCw,
  CheckCircle2,
  Globe,
  ExternalLink,
  Clock
} from 'lucide-react';
import { DealStatus } from '@meesho-automation/shared';

interface Deal {
  id: string;
  externalUrl: string;
  normalizedUrl: string;
  productName: string;
  mrp: number;
  offerPrice: number;
  wishlinkUrl?: string;
  status: DealStatus;
  scheduledTime?: string;
  platform: string;
  createdAt: string;
}

interface Log {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  details?: string;
}

interface Settings {
  wishlinkUrlInput: string;
  wishlinkGenerateBtn: string;
  wishlinkShortlinkText: string;
  adminEmail: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  duplicateCheckDays: string;
  whatsappStatus: 'CONNECTED' | 'DISCONNECTED' | 'INITIALIZING';
  whatsappQrCode: string;
}

type Message = { type: 'success' | 'error' | 'warning'; text: string };

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'queue' | 'duplicates' | 'settings' | 'logs'>('queue');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [settings, setSettings] = useState<Settings>({
    wishlinkUrlInput: '',
    wishlinkGenerateBtn: '',
    wishlinkShortlinkText: '',
    adminEmail: '',
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    duplicateCheckDays: '7',
    whatsappStatus: 'DISCONNECTED',
    whatsappQrCode: '',
  });

  // Deal Form State
  const [dealForm, setDealForm] = useState({
    externalUrl: '',
    productName: '',
    mrp: '',
    offerPrice: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<Message | null>(null);

  // Settings Save State
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<Message | null>(null);

  const [loading, setLoading] = useState(true);

  // API Callers
  const loadData = useCallback(async () => {
    try {
      // 1. Fetch settings
      const settingsRes = await fetch('/api/worker/settings');
      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        setSettings(settingsData.settings as Settings);
      }

      // 2. Fetch deals
      const dealsRes = await fetch('/api/worker/deals');
      const dealsData = await dealsRes.json();
      if (dealsData.success) {
        setDeals(dealsData.deals as Deal[]);
      }

      // 3. Fetch logs
      const logsRes = await fetch('/api/worker/logs?limit=50');
      const logsData = await logsRes.json();
      if (logsData.success) {
        setLogs(logsData.logs as Log[]);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for status updates
  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void loadData();
    }, 0);
    const interval = setInterval(() => {
      void loadData();
    }, 5000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadData]);

  // Form Handlers
  const handleDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormMsg(null);

    if (!dealForm.externalUrl || !dealForm.productName || !dealForm.mrp || !dealForm.offerPrice) {
      setFormMsg({ type: 'error', text: 'All fields are required' });
      setFormSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/worker/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalUrl: dealForm.externalUrl,
          productName: dealForm.productName,
          mrp: parseFloat(dealForm.mrp),
          offerPrice: parseFloat(dealForm.offerPrice),
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.duplicateDetected) {
          setFormMsg({
            type: 'warning',
            text: 'Warning: Duplicate URL detected. Saved as DUPLICATE_PENDING and paused for review.'
          });
        } else {
          setFormMsg({ type: 'success', text: 'Deal added successfully and scheduled for processing!' });
        }
        setDealForm({ externalUrl: '', productName: '', mrp: '', offerPrice: '' });
        loadData();
      } else {
        setFormMsg({ type: 'error', text: data.error });
      }
    } catch {
      setFormMsg({ type: 'error', text: 'Failed to submit deal. Server error.' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdateSelector = async (key: string, value: string) => {
    try {
      await fetch('/api/worker/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
    } catch (error) {
      console.error(`Failed to save config key: ${key}`, error);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSubmitting(true);
    setSettingsMsg(null);

    try {
      const keysToSave: Array<keyof Pick<
        Settings,
        | 'wishlinkUrlInput'
        | 'wishlinkGenerateBtn'
        | 'wishlinkShortlinkText'
        | 'adminEmail'
        | 'smtpHost'
        | 'smtpPort'
        | 'smtpUser'
        | 'smtpPass'
        | 'smtpFrom'
        | 'duplicateCheckDays'
      >> = [
        'wishlinkUrlInput',
        'wishlinkGenerateBtn',
        'wishlinkShortlinkText',
        'adminEmail',
        'smtpHost',
        'smtpPort',
        'smtpUser',
        'smtpPass',
        'smtpFrom',
        'duplicateCheckDays',
      ];

      for (const key of keysToSave) {
        await handleUpdateSelector(key, settings[key]);
      }

      setSettingsMsg({ type: 'success', text: 'All settings and selectors updated successfully.' });
      loadData();
    } catch {
      setSettingsMsg({ type: 'error', text: 'Failed to save settings configurations.' });
    } finally {
      setSettingsSubmitting(false);
    }
  };

  // Duplicate Actions
  const handleResolveDuplicate = async (id: string, approve: boolean) => {
    try {
      const res = await fetch('/api/worker/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: approve ? 'PENDING' : 'DISCARDED',
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch (err) {
      console.error('Failed to resolve duplicate deal:', err);
    }
  };

  const getStatusBadgeClass = (status: DealStatus) => {
    switch (status) {
      case 'PENDING': return 'badge badge-pending';
      case 'GENERATING': return 'badge badge-generating';
      case 'GENERATED': return 'badge badge-generated';
      case 'SCHEDULED': return 'badge badge-scheduled';
      case 'POSTED': return 'badge badge-posted';
      case 'FAILED': return 'badge badge-failed';
      case 'DUPLICATE_PENDING': return 'badge badge-duplicate';
      case 'DISCARDED': return 'badge badge-discarded';
      default: return 'badge';
    }
  };

  const duplicatesCount = deals.filter(d => d.status === 'DUPLICATE_PENDING').length;

  return (
    <div style={{ padding: '32px 16px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>
            <span className="text-gradient">Affiliate Command Center</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Automated E-commerce to WhatsApp Posting Core</p>
        </div>

        {/* WhatsApp Connection Status widget */}
        <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <span className={`status-dot ${
                settings.whatsappStatus === 'CONNECTED' ? 'online' : 
                settings.whatsappStatus === 'INITIALIZING' ? 'initializing' : 'offline'
              }`} />
              <strong style={{ fontSize: '14px' }}>WhatsApp Worker</strong>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Status: {settings.whatsappStatus || 'DISCONNECTED'}
            </div>
          </div>
          {settings.whatsappStatus !== 'CONNECTED' && settings.whatsappQrCode && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(settings.whatsappQrCode)}`}
                alt="Scan WhatsApp Web"
                style={{ width: '50px', height: '50px', border: '2px solid white', borderRadius: '4px' }}
                title="Scan to authenticate"
              />
              <span style={{ fontSize: '9px', marginTop: '2px', color: 'var(--color-secondary)' }}>Scan QR</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <ListOrdered size={16} /> Deals Queue
        </button>
        <button
          className={`tab-btn ${activeTab === 'duplicates' ? 'active' : ''}`}
          onClick={() => setActiveTab('duplicates')}
        >
          <AlertTriangle size={16} /> 
          Duplicate Queue 
          {duplicatesCount > 0 && (
            <span style={{ 
              marginLeft: '6px', 
              background: 'var(--color-danger)', 
              color: '#fff', 
              borderRadius: '50%', 
              padding: '2px 6px', 
              fontSize: '10px' 
            }}>{duplicatesCount}</span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon size={16} /> System Selectors & config
        </button>
        <button
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <Terminal size={16} /> Diagnostic Logs
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--color-secondary)' }} />
          <span style={{ marginLeft: '12px' }}>Loading Command Center...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: ADD DEAL & ACTIVE QUEUE */}
          {activeTab === 'queue' && (
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Form Side */}
              <div className="glass-panel">
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PlusCircle size={18} style={{ color: 'var(--color-primary)' }} />
                  Inject New Deal
                </h3>

                {formMsg && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    backgroundColor: formMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 
                                    formMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: formMsg.type === 'success' ? '#34d399' : 
                           formMsg.type === 'error' ? '#f87171' : '#fbbf24',
                    border: `1px solid ${
                      formMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 
                      formMsg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                    }`
                  }}>
                    {formMsg.text}
                  </div>
                )}

                <form onSubmit={handleDealSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      E-commerce Product Link (Meesho / Amazon)
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.meesho.com/s/p/..."
                      value={dealForm.externalUrl}
                      onChange={e => setDealForm({ ...dealForm, externalUrl: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Product Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Designer Sneakers for Men"
                      value={dealForm.productName}
                      onChange={e => setDealForm({ ...dealForm, productName: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        MRP (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="1999"
                        value={dealForm.mrp}
                        onChange={e => setDealForm({ ...dealForm, mrp: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Offer Price (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="599"
                        value={dealForm.offerPrice}
                        onChange={e => setDealForm({ ...dealForm, offerPrice: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" disabled={formSubmitting} style={{ marginTop: '8px' }}>
                    {formSubmitting ? 'Verifying Link...' : 'Add Deal to Queue'}
                  </button>
                </form>
              </div>

              {/* Table Side */}
              <div className="glass-panel">
                <h3 style={{ marginBottom: '16px' }}>Active Deals & Posting Queue</h3>
                {deals.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
                    No deals injected. Inject a Meesho/Amazon deal on the left to start!
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Platform</th>
                          <th>Product Name</th>
                          <th>Prices</th>
                          <th>Status</th>
                          <th>Scheduled Time</th>
                          <th>Links</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deals.map(deal => (
                          <tr key={deal.id}>
                            <td>
                              <span style={{ 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                background: deal.platform === 'MEESHO' ? '#ff3f6c20' : 
                                            deal.platform === 'AMAZON' ? '#ff990020' : 'rgba(255,255,255,0.05)',
                                color: deal.platform === 'MEESHO' ? '#ff3f6c' : 
                                       deal.platform === 'AMAZON' ? '#ff9900' : 'var(--text-primary)',
                                fontSize: '11px',
                                fontWeight: 700
                              }}>
                                {deal.platform}
                              </span>
                            </td>
                            <td>
                              <strong style={{ display: 'block', fontSize: '14px' }}>{deal.productName}</strong>
                            </td>
                            <td>
                              <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', fontSize: '12px', marginRight: '6px' }}>
                                ₹{deal.mrp}
                              </span>
                              <strong style={{ color: 'var(--color-secondary)' }}>₹{deal.offerPrice}</strong>
                            </td>
                            <td>
                              <span className={getStatusBadgeClass(deal.status)}>
                                {deal.status}
                              </span>
                            </td>
                            <td>
                              {deal.scheduledTime ? (
                                <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                                  <Clock size={12} />
                                  {new Date(deal.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Not scheduled</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <a href={deal.externalUrl} target="_blank" rel="noreferrer" title="Original Link" style={{ color: 'var(--text-secondary)' }}>
                                  <Globe size={14} />
                                </a>
                                {deal.wishlinkUrl && (
                                  <a href={deal.wishlinkUrl} target="_blank" rel="noreferrer" title="Wishlink Affiliate" style={{ color: 'var(--color-primary)' }}>
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DUPLICATE REVIEW QUEUE */}
          {activeTab === 'duplicates' && (
            <div className="glass-panel">
              <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />
                Duplicate Approval Queue
              </h3>
              
              {deals.filter(d => d.status === 'DUPLICATE_PENDING').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={40} style={{ color: 'var(--color-success)', marginBottom: '12px' }} />
                  <p>Hooray! No pending duplicates detected. Everything is clean.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {deals.filter(d => d.status === 'DUPLICATE_PENDING').map(deal => (
                    <div 
                      key={deal.id} 
                      className="glass-panel" 
                      style={{ 
                        background: 'rgba(245, 158, 11, 0.03)', 
                        borderColor: 'rgba(245, 158, 11, 0.2)',
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '20px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <span style={{
                            padding: '2px 8px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#fbbf24',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            {deal.platform}
                          </span>
                          <h4 style={{ fontSize: '16px' }}>{deal.productName}</h4>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                          Normalized URL: <code style={{ color: 'var(--color-secondary)' }}>{deal.normalizedUrl}</code>
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          MRP: <span style={{ textDecoration: 'line-through' }}>₹{deal.mrp}</span> | 
                          Offer Price: <strong style={{ color: 'var(--text-primary)' }}>₹{deal.offerPrice}</strong> |
                          Submitted: {new Date(deal.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          className="btn-primary" 
                          onClick={() => handleResolveDuplicate(deal.id, true)}
                          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: 'none' }}
                        >
                          Post Deal Anyway
                        </button>
                        <button 
                          className="btn-secondary" 
                          onClick={() => handleResolveDuplicate(deal.id, false)}
                          style={{ border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}
                        >
                          Discard Deal
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SYSTEM SELECTORS & CONFIG */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>
              
              {/* Form configs */}
              <div className="glass-panel">
                <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SettingsIcon size={20} style={{ color: 'var(--color-primary)' }} />
                  Automation Selector Configs
                </h3>

                {settingsMsg && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    backgroundColor: settingsMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: settingsMsg.type === 'success' ? '#34d399' : '#f87171',
                    border: `1px solid ${settingsMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    {settingsMsg.text}
                  </div>
                )}

                <form onSubmit={handleSettingsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Selector Inputs */}
                  <div>
                    <h4 style={{ color: 'var(--color-secondary)', fontSize: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', marginBottom: '12px' }}>
                      Wishlink Scraping Selectors (CSS/XPath)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          URL Input Box Selector
                        </label>
                        <input
                          type="text"
                          value={settings.wishlinkUrlInput}
                          onChange={e => setSettings({ ...settings, wishlinkUrlInput: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Generate Button Selector
                        </label>
                        <input
                          type="text"
                          value={settings.wishlinkGenerateBtn}
                          onChange={e => setSettings({ ...settings, wishlinkGenerateBtn: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Shortlink Output Element Selector
                        </label>
                        <input
                          type="text"
                          value={settings.wishlinkShortlinkText}
                          onChange={e => setSettings({ ...settings, wishlinkShortlinkText: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mail SMTP Alert settings */}
                  <div>
                    <h4 style={{ color: 'var(--color-secondary)', fontSize: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', marginBottom: '12px' }}>
                      Email Alarm Settings (Nodemailer SMTP)
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Recipient Email (Admin)
                        </label>
                        <input
                          type="email"
                          value={settings.adminEmail}
                          onChange={e => setSettings({ ...settings, adminEmail: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Sender Address (From)
                        </label>
                        <input
                          type="text"
                          value={settings.smtpFrom}
                          onChange={e => setSettings({ ...settings, smtpFrom: e.target.value })}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          SMTP Host
                        </label>
                        <input
                          type="text"
                          value={settings.smtpHost}
                          onChange={e => setSettings({ ...settings, smtpHost: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          SMTP Port
                        </label>
                        <input
                          type="text"
                          value={settings.smtpPort}
                          onChange={e => setSettings({ ...settings, smtpPort: e.target.value })}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          SMTP Username
                        </label>
                        <input
                          type="text"
                          value={settings.smtpUser}
                          onChange={e => setSettings({ ...settings, smtpUser: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          SMTP Password
                        </label>
                        <input
                          type="password"
                          value={settings.smtpPass}
                          onChange={e => setSettings({ ...settings, smtpPass: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* General Config */}
                  <div>
                    <h4 style={{ color: 'var(--color-secondary)', fontSize: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', marginBottom: '12px' }}>
                      Duplicate Filtering
                    </h4>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Duplicate Prevention Days Window
                      </label>
                      <input
                        type="number"
                        value={settings.duplicateCheckDays}
                        onChange={e => setSettings({ ...settings, duplicateCheckDays: e.target.value })}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" disabled={settingsSubmitting}>
                    {settingsSubmitting ? 'Saving Configuration...' : 'Save Configuration'}
                  </button>
                </form>
              </div>

              {/* Side Authentications QR code preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass-panel" style={{ textAlign: 'center' }}>
                  <h4 style={{ marginBottom: '12px' }}>WhatsApp Authentication</h4>
                  {settings.whatsappStatus === 'CONNECTED' ? (
                    <div style={{ padding: '20px 0' }}>
                      <CheckCircle2 size={48} style={{ color: 'var(--color-success)', margin: '0 auto 12px' }} />
                      <strong style={{ color: 'var(--color-success)', display: 'block', marginBottom: '6px' }}>Connected</strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>WhatsApp client is running in background successfully.</p>
                    </div>
                  ) : settings.whatsappQrCode ? (
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Scan this QR code from linked devices on your WhatsApp mobile application to connect.
                      </p>
                      <div style={{ display: 'inline-block', padding: '12px', background: '#fff', borderRadius: '8px', marginBottom: '12px' }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(settings.whatsappQrCode)}`}
                          alt="WhatsApp QR Code"
                          style={{ display: 'block', width: '200px', height: '200px' }}
                        />
                      </div>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-warning)' }}>Awaiting QR scan...</span>
                    </div>
                  ) : (
                    <div style={{ padding: '40px 0', color: 'var(--text-secondary)' }}>
                      <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 12px' }} />
                      <p style={{ fontSize: '12px' }}>Generating QR Code or starting WhatsApp service...</p>
                    </div>
                  )}
                </div>

                <div className="glass-panel">
                  <h4 style={{ marginBottom: '12px' }}>Wishlink Session Status</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Reuses the local profile login session to complete affiliate automation.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="status-dot online" />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Active (Browser context cached)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DIAGNOSTIC LOGS */}
          {activeTab === 'logs' && (
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>Diagnostic Execution Logs</h3>
                <button className="btn-secondary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={loadData}>
                  <RefreshCw size={14} /> Refresh Logs
                </button>
              </div>

              {logs.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
                  No system logs available yet.
                </p>
              ) : (
                <div style={{ overflowX: 'auto', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <table className="custom-table" style={{ marginTop: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '180px' }}>Timestamp</th>
                        <th style={{ width: '100px' }}>Level</th>
                        <th>Message</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id}>
                          <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: log.level === 'ERROR' ? 'rgba(239, 68, 68, 0.15)' : 
                                          log.level === 'WARN' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: log.level === 'ERROR' ? '#f87171' : 
                                     log.level === 'WARN' ? '#fbbf24' : '#34d399',
                            }}>
                              {log.level}
                            </span>
                          </td>
                          <td>
                            <strong style={{ fontSize: '13px' }}>{log.message}</strong>
                          </td>
                          <td>
                            {log.details && (
                              <pre style={{ 
                                fontSize: '11px', 
                                color: 'var(--text-secondary)', 
                                fontFamily: 'monospace',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '6px',
                                borderRadius: '4px',
                                overflowX: 'auto',
                                maxWidth: '400px'
                              }}>
                                {log.details}
                              </pre>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
