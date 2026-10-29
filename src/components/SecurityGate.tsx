import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useApp } from '../context/AppContext';
import { StaffLoginGate } from './StaffLoginGate';

interface SecurityGateProps {
  children: React.ReactNode;
}

export const SecurityGate: React.FC<SecurityGateProps> = ({ children }) => {
  const { users, switchUser } = useApp();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const appDataRef = useRef({ users, switchUser });
  appDataRef.current = { users, switchUser };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (active) { setAuthorized(false); setChecking(false); }
        return;
      }
      if (active) setChecking(true);
      try {
        const accessSnapshot = await getDoc(doc(db, 'staff_access', firebaseUser.uid));
        if (!accessSnapshot.exists()) throw new Error('missing-access');
        const access = accessSnapshot.data();
        const staffId = typeof access.staffId === 'string' ? access.staffId.trim() : '';
        const role = typeof access.role === 'string' ? access.role.trim() : '';
        if (access.active !== true || !staffId || !role) throw new Error('invalid-access');
        const authEmail = firebaseUser.email?.trim().toLowerCase() || '';
        const linkedUser = appDataRef.current.users.find((user) => {
          const userEmail = user.email?.trim().toLowerCase() || '';
          return staffId === user.id || staffId.toLowerCase() === userEmail || (Boolean(authEmail) && userEmail === authEmail);
        });
        if (!linkedUser || (linkedUser.email && authEmail && linkedUser.email.trim().toLowerCase() !== authEmail) || linkedUser.role !== role) {
          throw new Error('missing-user-link');
        }
        if (!(await appDataRef.current.switchUser(linkedUser.id))) throw new Error('missing-user-link');
        if (active) { setAuthorized(true); setChecking(false); }
      } catch {
        if (active) { setAuthorized(false); setChecking(false); }
        try { await signOut(auth); } catch { /* Deny access regardless. */ }
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [users]);

  if (checking) return <div className="min-h-screen flex items-center justify-center" role="status">جارٍ التحقق من هوية الموظفة...</div>;
  if (authorized) return <>{children}</>;
  return <StaffLoginGate />;
};
