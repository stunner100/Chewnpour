import React from 'react';
import { Link } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { TabBar } from '../../components/admin/AdminUi';
import DeniedCard from '../../components/admin/DeniedCard';
import { adminDashboardReducer, initialAdminDashboardState } from './adminDashboardReducer';
import { OverviewPanel } from './panels/OverviewPanel';
import { LearningPanel } from './panels/LearningPanel';
import { FeatureUsagePanel } from './panels/FeatureUsagePanel';
import { RevenuePanel } from './panels/RevenuePanel';
import { ContentPanel } from './panels/ContentPanel';
import { UsersPanel } from './panels/UsersPanel';
import { UploadsPanel } from './panels/UploadsPanel';
import { FeedbackPanel } from './panels/FeedbackPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { formatDateTime, formatNumber, formatTokenLabel } from '../../lib/admin/formatters';

const AdminDashboard = () => {
    const { user } = useAuth();
    const snapshot = useQuery(api.admin.getDashboardSnapshot, {});
    const diagnoseRetrievalForTopic = useAction(api.admin.diagnoseRetrievalForTopic);
    const reconcilePaymentReference = useAction(api.admin.reconcilePaymentReference);
    const addAdminEmail = useMutation(api.admin.addAdminEmail);
    const removeAdminEmail = useMutation(api.admin.removeAdminEmail);
    const setPaymentProvider = useMutation(api.admin.setPaymentProvider);
    const [adminState, dispatchAdmin] = React.useReducer(adminDashboardReducer, initialAdminDashboardState);
    const {
        newAdminEmail,
        adminActionLoading,
        adminActionError,
        billingActionError,
        billingActionMessage,
        reconcilingReferences,
        paymentProviderDraft,
        retrievalTopicId,
        retrievalDiagnostics,
        retrievalDiagnosticsLoading,
        retrievalDiagnosticsError,
        activeTab,
    } = adminState;
    const updateAdmin = (updates) => dispatchAdmin({ type: 'patch', updates });

    React.useEffect(() => {
        const selectedProvider = String(snapshot?.paymentProviderConfig?.selected || '').trim() || 'paystack';
        dispatchAdmin({
            type: 'patch',
            updates: { paymentProviderDraft: selectedProvider },
        });
    }, [snapshot?.paymentProviderConfig?.selected]);

    if (snapshot === undefined) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full size-12 border-t-2 border-b-2 border-primary"></div>
                    <p className="text-text-muted text-sm font-medium">Loading admin dashboard…</p>
                </div>
            </div>
        );
    }

    if (!snapshot.allowed) {
        return (
            <DeniedCard
                reason={snapshot.reason}
                signedInEmail={snapshot.signedInAs?.email || user?.email || ''}
                signedInUserId={snapshot.signedInAs?.userId || user?.id || ''}
            />
        );
    }

    const newUsersDays = Number(snapshot.windows?.newUsersDays) || 7;
    const activeUsersDays = Number(snapshot.windows?.activeUsersDays) || 7;
    const totals = snapshot.totals || {};
    const flags = snapshot.flags || {};
    const adminEmails = Array.isArray(snapshot.adminEmails) ? snapshot.adminEmails : [];
    const paymentProviderConfig = snapshot.paymentProviderConfig || null;
    const recentUsers = Array.isArray(snapshot.recentUsers) ? snapshot.recentUsers : [];
    const recentFeedback = Array.isArray(snapshot.recentFeedback) ? snapshot.recentFeedback : [];
    const recentProductResearchResponses = Array.isArray(snapshot.recentProductResearchResponses)
        ? snapshot.recentProductResearchResponses
        : (Array.isArray(snapshot.recentResearchResponses) ? snapshot.recentResearchResponses : []);
    const campaignPerformanceReports = Array.isArray(snapshot.campaignPerformanceReports)
        ? snapshot.campaignPerformanceReports
        : [];
    const signedInUsers = Array.isArray(snapshot.signedInUsers) ? snapshot.signedInUsers : [];
    const premiumUsers = Array.isArray(snapshot.premiumUsers) ? snapshot.premiumUsers : [];

    const handleAddAdminEmail = async (event) => {
        event.preventDefault();
        if (!newAdminEmail.trim()) return;
        updateAdmin({
            adminActionError: '',
            adminActionLoading: true,
        });
        try {
            await addAdminEmail({ email: newAdminEmail.trim() });
            updateAdmin({ newAdminEmail: '' });
        } catch (error) {
            updateAdmin({ adminActionError: String(error?.message || error || 'Failed to add admin email.') });
        } finally {
            updateAdmin({ adminActionLoading: false });
        }
    };

    const handleRemoveAdminEmail = async (email) => {
        updateAdmin({
            adminActionError: '',
            adminActionLoading: true,
        });
        try {
            await removeAdminEmail({ email });
        } catch (error) {
            updateAdmin({ adminActionError: String(error?.message || error || 'Failed to remove admin email.') });
        } finally {
            updateAdmin({ adminActionLoading: false });
        }
    };

    const handleSavePaymentProvider = async (event) => {
        event.preventDefault();
        if (!paymentProviderDraft.trim()) return;
        updateAdmin({
            adminActionError: '',
            adminActionLoading: true,
        });
        try {
            await setPaymentProvider({ provider: paymentProviderDraft });
        } catch (error) {
            updateAdmin({ adminActionError: String(error?.message || error || 'Failed to update payment provider.') });
        } finally {
            updateAdmin({ adminActionLoading: false });
        }
    };

    const handleReconcilePayment = async (reference) => {
        const normalizedReference = String(reference || '').trim();
        if (!normalizedReference) return;
        updateAdmin({
            billingActionError: '',
            billingActionMessage: '',
        });
        dispatchAdmin({ type: 'reconcileStarted', reference: normalizedReference });
        try {
            const result = await reconcilePaymentReference({ reference: normalizedReference });
            const baseMessage = `Reconciliation finished: ${formatTokenLabel(result?.result)}.`;
            const creditsMessage = Number(result?.grantedCredits) > 0
                ? ` ${formatNumber(result.grantedCredits)} credit${Number(result.grantedCredits) === 1 ? '' : 's'} granted.`
                : '';
            updateAdmin({ billingActionMessage: `${baseMessage}${creditsMessage}` });
        } catch (error) {
            updateAdmin({ billingActionError: String(error?.message || error || 'Failed to reconcile payment reference.') });
        } finally {
            dispatchAdmin({ type: 'reconcileFinished', reference: normalizedReference });
        }
    };

    const handleDiagnoseRetrieval = async (event) => {
        event.preventDefault();
        if (!retrievalTopicId.trim()) return;
        updateAdmin({
            retrievalDiagnosticsError: '',
            retrievalDiagnosticsLoading: true,
        });
        try {
            const diagnostics = await diagnoseRetrievalForTopic({ topicId: retrievalTopicId.trim() });
            updateAdmin({ retrievalDiagnostics: diagnostics });
        } catch (error) {
            updateAdmin({
                retrievalDiagnostics: null,
                retrievalDiagnosticsError: String(error?.message || error || 'Failed to inspect topic retrieval.'),
            });
        } finally {
            updateAdmin({ retrievalDiagnosticsLoading: false });
        }
    };

    const activePanel = activeTab === 'overview'
        ? <OverviewPanel snapshot={snapshot} totals={totals} activeUsersDays={activeUsersDays} newUsersDays={newUsersDays} flags={flags} />
        : activeTab === 'learning'
            ? <LearningPanel snapshot={snapshot} activeUsersDays={activeUsersDays} />
            : activeTab === 'features'
                ? <FeatureUsagePanel snapshot={snapshot} activeUsersDays={activeUsersDays} />
                : activeTab === 'revenue'
                    ? (
                        <RevenuePanel
                            snapshot={snapshot}
                            activeUsersDays={activeUsersDays}
                            handleReconcilePayment={handleReconcilePayment}
                            billingActionError={billingActionError}
                            billingActionMessage={billingActionMessage}
                            reconcilingReferences={reconcilingReferences}
                        />
                    )
                    : activeTab === 'content'
                        ? (
                            <ContentPanel
                                snapshot={snapshot}
                                retrievalTopicId={retrievalTopicId}
                                setRetrievalTopicId={(value) => updateAdmin({ retrievalTopicId: value })}
                                retrievalDiagnostics={retrievalDiagnostics}
                                retrievalDiagnosticsError={retrievalDiagnosticsError}
                                retrievalDiagnosticsLoading={retrievalDiagnosticsLoading}
                                handleDiagnoseRetrieval={handleDiagnoseRetrieval}
                            />
                        )
                        : activeTab === 'users'
                            ? <UsersPanel signedInUsers={signedInUsers} recentUsers={recentUsers} premiumUsers={premiumUsers} flags={flags} snapshot={snapshot} activeUsersDays={activeUsersDays} />
                            : activeTab === 'uploads'
                                ? <UploadsPanel snapshot={snapshot} />
                                : activeTab === 'feedback'
                                    ? (
                                        <FeedbackPanel
                                            recentFeedback={recentFeedback}
                                            recentProductResearchResponses={recentProductResearchResponses}
                                            campaignPerformanceReports={campaignPerformanceReports}
                                            totals={totals}
                                            activeUsersDays={activeUsersDays}
                                        />
                                    )
                                    : activeTab === 'settings'
                                        ? (
                                            <SettingsPanel
                                                adminEmails={adminEmails}
                                                handleAddAdminEmail={handleAddAdminEmail}
                                                handleRemoveAdminEmail={handleRemoveAdminEmail}
                                                newAdminEmail={newAdminEmail}
                                                setNewAdminEmail={(value) => updateAdmin({ newAdminEmail: value })}
                                                adminActionLoading={adminActionLoading}
                                                adminActionError={adminActionError}
                                                paymentProviderConfig={paymentProviderConfig}
                                                paymentProviderDraft={paymentProviderDraft}
                                                setPaymentProviderDraft={(value) => updateAdmin({ paymentProviderDraft: value })}
                                                handleSavePaymentProvider={handleSavePaymentProvider}
                                            />
                                        )
                                        : null;

    return (
        <div className="flex-1 px-space-6 py-space-6 pb-space-16 md:px-space-8">
            <div className="mx-auto max-w-container-max space-y-space-5">
                <section className="rounded-xl border border-border-subtle bg-surface p-space-6 shadow-sm">
                    <div className="flex flex-col gap-space-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                            <p className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-primary">Admin</p>
                            <h1 className="mt-space-1 font-display-md text-display-md text-text-primary tracking-tight">
                                ChewnPour Operations Dashboard
                            </h1>
                            <p className="mt-space-2 max-w-2xl font-body-base text-body-base text-text-secondary">
                                Monitor study activity, content processing, revenue, and support signals from the same workspace as the student dashboard.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-space-3">
                            <div className="rounded-xl border border-border-subtle bg-surface-soft px-space-4 py-space-3">
                                <p className="font-label-xs text-label-xs uppercase tracking-wider text-text-muted">Updated</p>
                                <p className="mt-1 font-label-md text-label-md text-text-primary">{formatDateTime(snapshot.generatedAt)}</p>
                            </div>
                            <Link
                                to="/dashboard"
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-default bg-surface px-space-4 py-space-3 font-label-md text-label-md text-text-primary transition-colors hover:bg-surface-soft hover:text-primary"
                            >
                                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                Main dashboard
                            </Link>
                        </div>
                    </div>
                </section>

                <TabBar activeTab={activeTab} onTabChange={(value) => updateAdmin({ activeTab: value })} />

                {activePanel}
            </div>
        </div>
    );
};

export default AdminDashboard;
