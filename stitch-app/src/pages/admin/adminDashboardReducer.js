export const initialAdminDashboardState = {
    newAdminEmail: '',
    adminActionLoading: false,
    adminActionError: '',
    billingActionError: '',
    billingActionMessage: '',
    reconcilingReferences: {},
    paymentProviderDraft: 'paystack',
    retrievalTopicId: '',
    retrievalDiagnostics: null,
    retrievalDiagnosticsLoading: false,
    retrievalDiagnosticsError: '',
    activeTab: 'overview',
};

export const adminDashboardReducer = (state, action) => {
    switch (action.type) {
        case 'patch':
            return { ...state, ...action.updates };
        case 'reconcileStarted':
            return {
                ...state,
                reconcilingReferences: {
                    ...state.reconcilingReferences,
                    [action.reference]: true,
                },
            };
        case 'reconcileFinished': {
            const reconcilingReferences = { ...state.reconcilingReferences };
            delete reconcilingReferences[action.reference];
            return { ...state, reconcilingReferences };
        }
        default:
            return state;
    }
};