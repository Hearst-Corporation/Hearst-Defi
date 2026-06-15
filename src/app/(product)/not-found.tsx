import { SegmentNotFound } from "@/components/error/segment-not-found";

export default function ProductNotFound() {
  return (
    <SegmentNotFound
      scope="Product · 404"
      message="The page you're looking for doesn't exist or has moved. Check the URL or head back to your portfolio."
      homeHref="/portfolio"
      homeLabel="Go to portfolio"
    />
  );
}
