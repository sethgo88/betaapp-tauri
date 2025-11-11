import "./App.css";
import NavContainer from "./components/navigation/nav.container";
import AppContextProvider from '@/components/app-context/app-provider'
import ToastContextProvider from "@/components/toast/toast-provider";

function App() {

	return (
		<AppContextProvider>
			<ToastContextProvider>
				<NavContainer />
			</ToastContextProvider>
		</AppContextProvider>
	);
}

export default App;
