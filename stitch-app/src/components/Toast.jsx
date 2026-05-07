import React from 'react';
import { WatermelonToaster } from './watermelon/WatermelonSonner';

// WatermelonToaster is a global toast system mounted at app root.
// This component is kept as a compatibility shim for legacy single-message usage.
const Toast = () => <WatermelonToaster position="bottom-center" />;

export default Toast;
