export interface ManualDeadline {
  id: string;
  title: string;
  deadline: string;
  courseName?: string;
  note?: string;
  createdAt: string;
}

export type DeadlineListItem =
  | {
      kind: 'homework';
      id: string;
      title: string;
      courseName: string;
      deadline: string;
      status: 'pending' | 'submitted' | 'graded' | 'overdue';
      submitted: boolean;
    }
  | {
      kind: 'manual';
      id: string;
      title: string;
      courseName?: string;
      deadline: string;
      note?: string;
      status: 'pending';
      submitted: false;
    };

