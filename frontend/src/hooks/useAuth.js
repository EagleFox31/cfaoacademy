import { useContext } from 'react'
import { AuthContext } from '../context/sessionContext.js'

export default function useAuth() {
  return useContext(AuthContext)
}
