import axios from 'axios'

const BASE = '/api/user-preferences'

export const userPreferencesApi = {
  get: (key: string): Promise<string | null> =>
    axios.get<{ value: string }>(`${BASE}/${key}`)
      .then(r => r.data.value)
      .catch(err => {
        if (err.response?.status === 404) return null
        throw err
      }),

  set: (key: string, value: string): Promise<void> =>
    axios.put(`${BASE}/${key}`, { value }).then(() => undefined),
}
