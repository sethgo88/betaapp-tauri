import { useState, ReactNode } from 'react';
import NavContext, { NavContextType } from './nav-context';

type Props = { children: ReactNode }

export default function NavContextProvider({ children }: Props) {
  const [appState, setAppState] = useState<NavContextType['appState']>('home');

  const context: NavContextType = { setAppState, appState };

  return (
    <NavContext.Provider value={context}>
      {children}
    </NavContext.Provider>
  );
}