import { createContext, useContext } from 'react'

export const AppStateContext = createContext({
  activeListId: '',
  setActiveListId: () => {},
})

export function useAppState() {
  return useContext(AppStateContext)
}
