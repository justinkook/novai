import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

export function LoadingSearchResultCards() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: This is a hardcoded loading array that never changes
        <Card className="w-full" key={`card-loading-web-search-${i}`}>
          <CardHeader>
            <CardTitle>
              <Skeleton className="w-[85%] h-5" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="w-[70%] h-4" />
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <Skeleton className="w-full h-3" />
            <Skeleton className="w-full h-3" />
            <Skeleton className="w-[90%] h-3" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
