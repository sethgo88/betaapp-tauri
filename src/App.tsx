import Database from "@tauri-apps/plugin-sql";
import { useContext, useEffect, useState } from "react";
import "./App.css";
import NavbarContainer from "./components/navigation/nav.container";
import NavContainer from "./components/navigation/nav.container";
import NavContext from "./components/navigation/nav-context";
import NavContextProvider from "./components/navigation/nav-provider";

type User = {
	id: number;
	name: string;
	email: string;
};

function App() {
	const [isLoadingUsers, setIsLoadingUsers] = useState(true);
	const [users, setUsers] = useState<User[]>([]);
	const [name, setName] = useState<string>("");
	const [email, setEmail] = useState<string>("");
	const [error, setError] = useState<string>("");
	const { appState } = useContext(NavContext);

	// async function getUsers() {
	//   try {
	//     const db = await Database.load("sqlite:default.db");
	//     const dbUsers = await db.select<User[]>("SELECT * FROM users");

	//     setError("");
	//     setUsers(dbUsers);
	//     setIsLoadingUsers(false);
	//   } catch (error) {
	//     console.log(error);
	//     setError("Failed to get users - check console");
	//   }
	// }

	// async function setUser(user: Omit<User, "id">) {
	//   try {
	//     setIsLoadingUsers(true);
	//     const db = await Database.load("sqlite:default.db");

	//     await db.execute("INSERT INTO users (name, email) VALUES ($1, $2)", [
	//       user.name,
	//       user.email,
	//     ]);

	//     getUsers().then(() => setIsLoadingUsers(false));
	//   } catch (error) {
	//     console.log(error);
	//     setError("Failed to insert user - check console");
	//   }
	// }

	// useEffect(() => {
	//   getUsers();
	// }, []);

	return (
		<NavContextProvider>
			<NavContainer />
		</NavContextProvider>
		// <>
		// <main className="px-[1vh] pt-[10vh]">

		//   {isLoadingUsers ? (
		//     <div>Loading users...</div>
		//   ) : (
		//     <div
		//       style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
		//       <form
		//         className="column"
		//         onSubmit={(e) => {
		//           e.preventDefault();
		//           setUser({ name, email });
		//           getUsers();
		//         }}>
		//         <input
		//           id="name-input"
		//           onChange={(e) => setName(e.currentTarget.value)}
		//           placeholder="Enter a name..."
		//         />
		//         <input
		//           type="email"
		//           id="email-input"
		//           onChange={(e) => setEmail(e.currentTarget.value)}
		//           placeholder="Enter an email..."
		//         />
		//         <button type="submit">Add User</button>
		//       </form>

		//       <div
		//         style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
		//         <h1>Users</h1>
		//         <table>
		//           <thead>
		//             <tr>
		//               <th>ID</th>
		//               <th>Name</th>
		//               <th>Email</th>
		//             </tr>
		//           </thead>
		//           <tbody>
		//             {users.map((user) => (
		//               <tr key={user.id}>
		//                 <td>{user.id}</td>
		//                 <td>{user.name}</td>
		//                 <td>{user.email}</td>
		//               </tr>
		//             ))}
		//           </tbody>
		//         </table>
		//       </div>
		//     </div>
		//   )}

		//   {error && <p>{error}</p>}
		// </main>
		//   <NavbarContainer />
		// </>
	);
}

export default App;
