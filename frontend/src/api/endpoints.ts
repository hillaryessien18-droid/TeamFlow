import { api } from "./client";
import type {
  Activity,
  AuthResponse,
  Comment,
  Dashboard,
  Membership,
  Organization,
  Priority,
  Project,
  ProjectStatus,
  Role,
  Task,
  TaskStatus,
  Team,
  User,
} from "./types";

type Params = Record<string, string | number | undefined | null>;

function clean(params: Params) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login/", { email, password }).then((r) => r.data),
  register: (data: { email: string; full_name: string; password: string }) =>
    api.post<AuthResponse>("/auth/register/", data).then((r) => r.data),
  logout: (refresh: string) => api.post("/auth/logout/", { refresh }),
  me: () => api.get<User>("/auth/me/").then((r) => r.data),
  updateMe: (data: { full_name: string }) => api.patch<User>("/auth/me/", data).then((r) => r.data),
  changePassword: (current_password: string, new_password: string) =>
    api.post<{ detail: string }>("/auth/change-password/", { current_password, new_password }).then((r) => r.data),
  requestPasswordReset: (email: string) =>
    api.post<{ detail: string }>("/auth/password-reset/", { email }).then((r) => r.data),
  confirmPasswordReset: (uid: string, token: string, new_password: string) =>
    api.post<{ detail: string }>("/auth/password-reset/confirm/", { uid, token, new_password }).then((r) => r.data),
};

export const orgApi = {
  list: () => api.get<Organization[]>("/organizations/").then((r) => r.data),
  create: (data: { name: string; description: string }) =>
    api.post<Organization>("/organizations/", data).then((r) => r.data),
  update: (id: number, data: { name: string; description: string }) =>
    api.patch<Organization>(`/organizations/${id}/`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/organizations/${id}/`),
};

export const memberApi = {
  list: (organization: number) =>
    api.get<Membership[]>("/memberships/", { params: { organization } }).then((r) => r.data),
  add: (data: { organization: number; email: string; role: Role }) =>
    api.post<Membership>("/memberships/", data).then((r) => r.data),
  updateRole: (id: number, role: Role) => api.patch<Membership>(`/memberships/${id}/`, { role }).then((r) => r.data),
  remove: (id: number) => api.delete(`/memberships/${id}/`),
};

export interface TeamInput {
  organization: number;
  name: string;
  description: string;
  member_ids: number[];
}

export const teamApi = {
  list: (organization: number) => api.get<Team[]>("/teams/", { params: { organization } }).then((r) => r.data),
  create: (data: TeamInput) => api.post<Team>("/teams/", data).then((r) => r.data),
  update: (id: number, data: Partial<TeamInput>) => api.patch<Team>(`/teams/${id}/`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/teams/${id}/`),
};

export interface ProjectInput {
  organization: number;
  name: string;
  description: string;
  due_date: string | null;
  team: number | null;
}

export const projectApi = {
  list: (params: { organization?: number; status?: ProjectStatus; search?: string }) =>
    api.get<Project[]>("/projects/", { params: clean(params) }).then((r) => r.data),
  get: (id: number) => api.get<Project>(`/projects/${id}/`).then((r) => r.data),
  create: (data: ProjectInput) => api.post<Project>("/projects/", data).then((r) => r.data),
  update: (id: number, data: Partial<ProjectInput>) => api.patch<Project>(`/projects/${id}/`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/projects/${id}/`),
  archive: (id: number) => api.post<Project>(`/projects/${id}/archive/`).then((r) => r.data),
  unarchive: (id: number) => api.post<Project>(`/projects/${id}/unarchive/`).then((r) => r.data),
};

export interface TaskInput {
  project: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: number | null;
  due_date: string | null;
}

export const taskApi = {
  list: (params: { project?: number; organization?: number; assignee?: number | "me"; status?: TaskStatus }) =>
    api.get<Task[]>("/tasks/", { params: clean(params) }).then((r) => r.data),
  create: (data: TaskInput) => api.post<Task>("/tasks/", data).then((r) => r.data),
  update: (id: number, data: Partial<TaskInput>) => api.patch<Task>(`/tasks/${id}/`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/tasks/${id}/`),
  move: (id: number, status: TaskStatus, position: number) =>
    api.post<Task>(`/tasks/${id}/move/`, { status, position }).then((r) => r.data),
};

export const commentApi = {
  list: (task: number) => api.get<Comment[]>("/comments/", { params: { task } }).then((r) => r.data),
  create: (task: number, body: string) => api.post<Comment>("/comments/", { task, body }).then((r) => r.data),
  update: (id: number, body: string) => api.patch<Comment>(`/comments/${id}/`, { body }).then((r) => r.data),
  remove: (id: number) => api.delete(`/comments/${id}/`),
};

export const activityApi = {
  list: (params: { organization?: number; project?: number; task?: number; limit?: number }) =>
    api.get<Activity[]>("/activity/", { params: clean(params) }).then((r) => r.data),
};

export const dashboardApi = {
  get: (organization: number) => api.get<Dashboard>("/dashboard/", { params: { organization } }).then((r) => r.data),
};
