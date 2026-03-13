import { useRouterState } from "@tanstack/react-router";

export const useCurrentRoute = () => {
	return useRouterState({ select: (s) => s.location.pathname });
};
