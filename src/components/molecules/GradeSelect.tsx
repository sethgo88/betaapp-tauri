import { Select } from "@/components/atoms/Select";
import { useGrades } from "@/features/grades/grades.queries";

const DEFAULT_GRADE: Record<"sport" | "boulder" | "trad", string> = {
	sport: "5.12a",
	trad: "5.12a",
	boulder: "v5",
};

interface GradeSelectProps {
	routeType: "sport" | "boulder" | "trad";
	value: string;
	onChange: (value: string) => void;
	id?: string;
	name?: string;
}

export const GradeSelect = ({
	routeType,
	value,
	onChange,
	id,
	name,
}: GradeSelectProps) => {
	const { data: grades = [] } = useGrades(routeType);
	const resolved = value || DEFAULT_GRADE[routeType];

	return (
		<Select
			id={id}
			name={name}
			value={resolved}
			onChange={(e) => onChange(e.target.value)}
		>
			{grades.map((g) => (
				<option key={g.id} value={g.grade}>
					{g.grade}
				</option>
			))}
		</Select>
	);
};
