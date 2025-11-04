import "./App.css";
import NavContainer from "./components/navigation/nav.container";
import NavContextProvider from "./components/navigation/nav-provider";

function App() {

	return (
		<NavContextProvider>
			<NavContainer />
		</NavContextProvider>
	);
}

export default App;
