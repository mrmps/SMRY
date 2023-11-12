import Image from 'next/image';

type OutletType = {
  name: string;
  url: string;
};

const outlets: OutletType[] = [
  { "name": "The New York Times", "url": "nytimes.com" },
  { "name": "The Wall Street Journal", "url": "wsj.com" },
  { "name": "Bloomberg", "url": "bloomberg.com" },
  { "name": "Reuters", "url": "reuters.com" },
  { "name": "Financial Times", "url": "ft.com" },
  { "name": "The Washington Post", "url": "washingtonpost.com" },
  { "name": "CNN", "url": "cnn.com" },
  { "name": "BBC", "url": "bbc.com" },
  { "name": "The Guardian", "url": "theguardian.com" },
  { "name": "Forbes", "url": "forbes.com" },
  { "name": "The Economist", "url": "economist.com" },
  { "name": "Business Insider", "url": "businessinsider.com" },
  { "name": "Los Angeles Times", "url": "latimes.com" },
  { "name": "National Geographic", "url": "nationalgeographic.com" },
  { "name": "The Atlantic", "url": "theatlantic.com" },
  { "name": "Wired", "url": "wired.com" },
  { "name": "Time", "url": "time.com" },
  { "name": "Newsweek", "url": "newsweek.com" },
  { "name": "Harvard Business Review", "url": "hbr.org" },
  { "name": "Vanity Fair", "url": "vanityfair.com" },
  { "name": "The New Yorker", "url": "newyorker.com" },
  { "name": "MIT Technology Review", "url": "technologyreview.com" },
  { "name": "Scientific American", "url": "scientificamerican.com" },
  { "name": "Al Jazeera", "url": "aljazeera.com" },
  { "name": "Fox News", "url": "foxnews.com" },
  { "name": "NBC News", "url": "nbcnews.com" },
  { "name": "CBS News", "url": "cbsnews.com" },
  { "name": "USA Today", "url": "usatoday.com" },
  { "name": "The Huffington Post", "url": "huffpost.com" },
  { "name": "The Boston Globe", "url": "bostonglobe.com" }
];

export function Banner() {
  // Repeat outlets to ensure continuous flow
  const repeatedOutlets = Array(5).fill(outlets).flat(); // Adjust the number as needed

  return (
    <section className="bg-white dark:bg-zinc-900 py-12 overflow-hidden">
      <h2 className="text-center text-2xl font-bold text-zinc-600 dark:text-zinc-200 mb-6">
        Hop over these paywalls:
      </h2>
      <div className="mx-auto flex space-x-4" style={{ maxWidth: '1000px', animation: 'scroll 60s linear infinite' }}>
        {repeatedOutlets.map((outlet, index) => (
          <Outlet key={`${outlet.name}-${index}`} {...outlet} />
        ))}
      </div>
    </section>
  );
}
const Outlet = ({ name, url }: OutletType) => (
  <div className="flex flex-col items-center space-y-2">
    <div className="w-16 h-16 flex justify-center items-center"> {/* Adjust width and height as needed */}
      <Image
        alt={name}
        src={`https://www.google.com/s2/favicons?sz=64&domain=${url}`}
        width={32} // Increased size
        height={32} // Increased size
        className="rounded-full"
      />
    </div>
  </div>
);
