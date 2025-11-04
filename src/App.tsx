import "./App.css";
import NavContainer from "./components/navigation/nav.container";
import NavContextProvider from "./components/navigation/nav-provider";
import ToastContextProvider from "@/components/toast/toast-provider";

function App() {

	return (
		<NavContextProvider>
			<ToastContextProvider>
				<NavContainer />
			</ToastContextProvider>
		</NavContextProvider>
	);
}

export default App;
