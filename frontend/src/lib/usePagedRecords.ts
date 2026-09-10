import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export function usePagedRecords<T>(key: string, path: string) {
  const [page, setPage] = useState(0)
  const query = useQuery({ queryKey: [key, 'page', page], queryFn: () => api.get<T[]>(`${path}${path.includes('?') ? '&' : '?'}skip=${page * 50}&limit=50`) })
  return { ...query, page, setPage }
}
