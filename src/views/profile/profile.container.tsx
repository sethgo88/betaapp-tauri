import { useForm } from "@tanstack/react-form";
import { invoke } from "@tauri-apps/api/core";
import { useContext, useEffect } from "react";
import AppContext from "@/components/app-context/app-context";
import { Button } from "@/components/button/button";
import { FormInput } from "@/components/form/form-input";
import PageWrapper from "@/components/page-wrapper/page-wrapper";
import type { UserType } from "@/types/user";

const ProfileContainer = () => {
	const { userInfo, setUserInfo } = useContext(AppContext);

	async function getUser() {
		const response: UserType[] = await invoke("get_user");
		if(response){
			setUserInfo(response[0]);
		} else {
			setUserInfo(
				{
					username: "",
					email: "",
					phone: ""
				}
			)
		}
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: <run on first render>
	useEffect(() => {
		getUser();
	}, []);

	async function addUser(user: UserType) {
		return await invoke("add_user", {
			user,
		});
	}

	async function editUser(user: UserType) {
		return await invoke("update_user", {
			user,
		});
	}

	const form = useForm({
		onSubmit: async ({ value }) => {
			if (!value.email && !value.phone && !value.username) return;
			const payload = {
				id: userInfo?.id ?? crypto.randomUUID(),
				username: value.username,
				email: value.email,
				phone: value.phone,
				synced: "",
			};
			if (!userInfo) {
				const response = await addUser(payload);
				if (response) {
					setUserInfo(payload);
				}
			} else {
				const response = await editUser(payload);
				if (response) {
					setUserInfo(payload);
				}
			}
		},
		defaultValues: {
			username: userInfo?.username ?? "",
			email: userInfo?.email ?? "",
			phone: userInfo?.phone ?? "",
		},
	});

	return (
		<PageWrapper>
			{userInfo && (
				<div>
					<p>username: {userInfo.username}</p>
					<p>phone: {userInfo.phone}</p>
					<p>email: {userInfo.email}</p>
				</div>
			)}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				id="profile-form"
				className="grid grid-rows-[auto_1fr] h-full gap-4"
			>
				<div className="flex flex-col gap-2">
					<form.Field name="username">
						{(field) => (
							<FormInput
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Username"
								errorState={field.state.meta.errors.length > 0}
							/>
						)}
					</form.Field>
				</div>
				<div className="flex flex-col gap-2">
					<form.Field name="email">
						{(field) => (
							<FormInput
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Email"
								errorState={field.state.meta.errors.length > 0}
							/>
						)}
					</form.Field>
				</div>
				<div className="flex flex-col gap-2">
					<form.Field name="phone">
						{(field) => (
							<FormInput
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Phone"
								errorState={field.state.meta.errors.length > 0}
							/>
						)}
					</form.Field>
				</div>
				<div className="flex flex-col gap-2">
					<Button type="submit" className="py-2">
						{!userInfo ? "Add" : "Update"} User
					</Button>
				</div>
			</form>
		</PageWrapper>
	);
};

export default ProfileContainer;
