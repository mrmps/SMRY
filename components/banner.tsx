import Image from 'next/image';
import Link from 'next/link';

type OutletType = {
  name: string;
  url: string;
  famousArticle: string;
};

// const outlets: OutletType[] = [
//   { "name": "The New York Times", "url": "nytimes.com" },
//   { "name": "The Wall Street Journal", "url": "wsj.com" },
//   { "name": "Bloomberg", "url": "bloomberg.com" },
//   { "name": "Reuters", "url": "reuters.com" },
//   { "name": "Financial Times", "url": "ft.com" },
//   { "name": "The Washington Post", "url": "washingtonpost.com" },
//   { "name": "CNN", "url": "cnn.com" },
//   { "name": "BBC", "url": "bbc.com" },
//   { "name": "The Guardian", "url": "theguardian.com" },
//   { "name": "Forbes", "url": "forbes.com" },
//   { "name": "The Economist", "url": "economist.com" },
//   { "name": "Business Insider", "url": "businessinsider.com" },
//   { "name": "Los Angeles Times", "url": "latimes.com" },
//   { "name": "National Geographic", "url": "nationalgeographic.com" },
//   { "name": "The Atlantic", "url": "theatlantic.com" },
//   { "name": "Wired", "url": "wired.com" },
//   { "name": "Time", "url": "time.com" },
//   { "name": "Newsweek", "url": "newsweek.com" },
//   { "name": "Harvard Business Review", "url": "hbr.org" },
//   { "name": "Vanity Fair", "url": "vanityfair.com" },
//   { "name": "The New Yorker", "url": "newyorker.com" },
//   { "name": "MIT Technology Review", "url": "technologyreview.com" },
//   { "name": "Scientific American", "url": "scientificamerican.com" },
//   { "name": "Al Jazeera", "url": "aljazeera.com" },
//   { "name": "Fox News", "url": "foxnews.com" },
//   { "name": "NBC News", "url": "nbcnews.com" },
//   { "name": "CBS News", "url": "cbsnews.com" },
//   { "name": "USA Today", "url": "usatoday.com" },
//   { "name": "The Huffington Post", "url": "huffpost.com" },
//   { "name": "The Boston Globe", "url": "bostonglobe.com" }
// ];

const outlets: OutletType[] = [
  { "name": "The New York Times", "url": "nytimes.com", "famousArticle": "https://www.nytimes.com/interactive/2020/world/coronavirus-maps.html" },
  { "name": "The Wall Street Journal", "url": "wsj.com", "famousArticle": "https://www.wsj.com/articles/facebook-files-11631713039" },
  { "name": "Bloomberg", "url": "bloomberg.com", "famousArticle": "https://www.bloomberg.com/graphics/2020-venezuela-sanctions/" },
  { "name": "Reuters", "url": "reuters.com", "famousArticle": "https://www.reuters.com/investigates/section/myanmar-rohingya/" },
  { "name": "Financial Times", "url": "ft.com", "famousArticle": "https://www.ft.com/content/97266b9e-9408-11ea-abcd-371e24b679ed" },
  { "name": "The Washington Post", "url": "washingtonpost.com", "famousArticle": "https://www.washingtonpost.com/graphics/2020/national/police-shootings-2020/" },
  { "name": "CNN", "url": "cnn.com", "famousArticle": "https://www.cnn.com/2020/04/26/health/us-coronavirus-sunday/index.html" },
  { "name": "BBC", "url": "bbc.com", "famousArticle": "https://www.bbc.com/news/world-51235105" },
  { "name": "The Guardian", "url": "theguardian.com", "famousArticle": "https://www.theguardian.com/environment/ng-interactive/2019/oct/09/revealed-20-firms-third-carbon-emissions" },
  { "name": "Forbes", "url": "forbes.com", "famousArticle": "https://www.forbes.com/sites/randalllane/2020/12/01/why-forbes-is-tracking-billionaire-wealth-in-real-time-during-the-pandemic/" },
  { "name": "The Economist", "url": "economist.com", "famousArticle": "https://www.economist.com/briefing/2020/04/16/the-covid-19-pandemic-could-last-for-years" },
  { "name": "Business Insider", "url": "businessinsider.com", "famousArticle": "https://www.businessinsider.com/amazon-jeff-bezos-warehouse-employee-treatment-coronavirus-covid-19-2020-4" },
  { "name": "Los Angeles Times", "url": "latimes.com", "famousArticle": "https://www.latimes.com/california/story/2020-08-22/california-fires-climate-change-analysis" },
  { "name": "National Geographic", "url": "nationalgeographic.com", "famousArticle": "https://www.nationalgeographic.com/science/article/how-coronavirus-infects-cells-and-makes-people-sick-cvd" },
  { "name": "The Atlantic", "url": "theatlantic.com", "famousArticle": "https://www.theatlantic.com/magazine/archive/2020/06/underlying-conditions/610261/" },
  { "name": "Wired", "url": "wired.com", "famousArticle": "https://www.wired.com/story/coronavirus-covid-19-most-compelling-visualizations/" },
  { "name": "Time", "url": "time.com", "famousArticle": "https://time.com/5817363/coronavirus-america-future/" },
  { "name": "Newsweek", "url": "newsweek.com", "famousArticle": "https://www.newsweek.com/2020/04/24/how-we-will-live-after-coronavirus-pandemic-passes-1495737.html" },
  { "name": "Harvard Business Review", "url": "hbr.org", "famousArticle": "https://hbr.org/2020/03/that-discomfort-youre-feeling-is-grief" },
  { "name": "Vanity Fair", "url": "vanityfair.com", "famousArticle": "https://www.vanityfair.com/news/2020/04/how-new-york-city-emergency-room-doctors-are-bracing-for-the-peak-of-the-pandemic" },
  { "name": "The New Yorker", "url": "newyorker.com", "famousArticle": "https://www.newyorker.com/magazine/2020/03/30/the-fight-to-contain-the-coronavirus" },
  { "name": "MIT Technology Review", "url": "technologyreview.com", "famousArticle": "https://www.technologyreview.com/2020/04/10/999239/covid-pandemic-10-technologies/" },
  { "name": "Scientific American", "url": "scientificamerican.com", "famousArticle": "https://www.scientificamerican.com/article/how-covid-19-is-changing-the-future-of-vaccines/" },
  { "name": "Al Jazeera", "url": "aljazeera.com", "famousArticle": "https://www.aljazeera.com/news/2020/4/5/coronavirus-which-countries-have-confirmed-cases" },
  { "name": "Fox News", "url": "foxnews.com", "famousArticle": "https://www.foxnews.com/health/coronavirus-everything-you-need-to-know" },
  { "name": "NBC News", "url": "nbcnews.com", "famousArticle": "https://www.nbcnews.com/health/coronavirus" },
  { "name": "CBS News", "url": "cbsnews.com", "famousArticle": "https://www.cbsnews.com/news/coronavirus-pandemic-mental-health-toll-health-care-workers/" },
  { "name": "USA Today", "url": "usatoday.com", "famousArticle": "https://www.usatoday.com/in-depth/news/nation/2020/04/10/coronavirus-death-toll-marks-u-s-deadliest-week-flu-comparison/2965011001/" },
  { "name": "The Huffington Post", "url": "huffpost.com", "famousArticle": "https://www.huffpost.com/entry/climate-change-covid-19-nature_n_5e8b935bc5b6e1a2e0fa8e6b" },
  { "name": "The Boston Globe", "url": "bostonglobe.com", "famousArticle": "https://www.bostonglobe.com/2020/04/08/nation/coronavirus-could-hit-homeless-hard/" }
];

// The rest of your Banner and Outlet component code remains the same.


export function Banner() {
  // Repeat outlets to ensure continuous flow
  const repeatedOutlets = Array(5).fill(outlets).flat(); // Adjust the number as needed

  return (
    <section className="z-20 py-12 overflow-hidden max-w-xs sm:max-w-full">
      <h2 className="text-center text-2xl font-bold text-zinc-700 dark:text-zinc-200 mb-6">
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
const Outlet = ({ name, url, famousArticle }: OutletType) => (
  <div className="flex flex-col items-center space-y-2">
    {/* <Link href={`/${famousArticle}`} target='_blank'> */}
        <div className="w-16 h-16 flex justify-center items-center"> {/* Adjust width and height as needed */}
          <Image
            alt={name}
            src={`https://www.google.com/s2/favicons?sz=64&domain=${url}`}
            width={32} // Increased size
            height={32} // Increased size
            className="rounded-full"
          />
        </div>
    {/* </Link> */}
  </div>
);
