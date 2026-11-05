export type Role = "owner" | "admin" | "member";
export type TaskStatus = "todo" | "in_progress" | "completed";
export type Priority = "low" | "medium" | "high" | "urgent";
export type ProjectStatus = "active" | "archived";

export interface User {
  id: number;
  email: string;
  full_name: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface Organization {
  id: number;
  name: string;
  description: string;
  created_at: string;
  my_role: Role | null;
  member_count: number;
  project_count: number;
}

export interface Membership {
  id: number;
  organization: number;
  user: User;
  role: Role;
  joined_at: string;
}

export interface Team {
  id: number;
  organization: number;
  name: string;
  description: string;
  members: User[];
  created_at: string;
}

export interface Project {
  id: number;
  organization: number;
  team: number | null;
  team_name: string | null;
  name: string;
  description: string;
  status: ProjectStatus;
  due_date: string | null;
  created_by: User | null;
  created_at: string;
  updated_at: string;
  task_count: number;
  completed_count: number;
  progress: number;
}

export interface Task {
  id: number;
  project: number;
  project_name: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: number | null;
  assignee_detail: User | null;
  due_date: string | null;
  position: number;
  created_by: User | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  comment_count: number;
  is_overdue: boolean;
}

export interface Comment {
  id: number;
  task: number;
  author: User;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  organization: number;
  project: number | null;
  project_name: string | null;
  task: number | null;
  task_title: string | null;
  actor: User | null;
  verb: string;
  message: string;
  created_at: string;
}

export interface Dashboard {
  role: Role;
  member_count: number;
  projects: { total: number; active: number; archived: number };
  tasks: {
    total: number;
    todo: number;
    in_progress: number;
    completed: number;
    overdue: number;
    completion_rate: number;
  };
  open_by_priority: Record<Priority, number>;
  project_progress: Project[];
  my_tasks: Task[];
  recent_activity: Activity[];
}
