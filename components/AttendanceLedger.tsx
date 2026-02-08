import React from 'react';
import { Member } from '../types';

interface AttendanceLedgerProps {
  currentUser?: Member;
}

export const AttendanceLedger: React.FC<AttendanceLedgerProps> = ({ currentUser }) => {
  return <div className="p-4">Attendance Ledger</div>;
};

export default AttendanceLedger;
