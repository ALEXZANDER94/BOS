import axios from 'axios'

export interface WorkspaceUser {
  email: string
  name:  string
}

export const workspaceApi = {
  getUsers: (alias?: string) =>
    axios.get<WorkspaceUser[]>('/api/workspace/users', {
      params: alias ? { alias } : undefined,
    }).then(r => r.data),
}
