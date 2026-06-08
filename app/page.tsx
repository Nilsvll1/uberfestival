import { supabase } from "../lib/supabase";
import FestivalMap from "./components/FestivalMap";

export default async function Home() {
  const { data, error } = await supabase
    .from("festivals")
    .select("*");

  if (error) {
    return (
      <main className="p-10">
        <h1 className="text-3xl font-bold text-red-600">
          Erreur Supabase
        </h1>

        <pre className="mt-4 p-4 bg-gray-100 rounded">
          {error.message}
        </pre>
      </main>
    );
  }

  return (
    <main className="p-10">
      <h1 className="text-4xl font-bold mb-6">
        UberFestival
      </h1>

      <p className="text-xl mb-6">
        Festivals trouvés : {data?.length ?? 0}
      </p>

      <FestivalMap festivals={data || []} />
    </main>
  );
}