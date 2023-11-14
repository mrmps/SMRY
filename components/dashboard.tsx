"use client";
// "EcGjSuUaBYQByIJiudNwWNhcBHWtfhDs"
import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/outline";
import parse from "html-react-parser";

interface Highlight {
  text: string;
  startIndex: number;
  endIndex: number;
}

interface Segment {
  summary: string | null;
  segmentHtml: string;
  highlights: Highlight[];
}

interface JsonData {
  id: string;
  segments: Segment[];
}
function applyHighlights(segmentHtml: string, highlights: Highlight[]): JSX.Element {
  if (!highlights || highlights.length === 0) {
    return <span dangerouslySetInnerHTML={{ __html: segmentHtml }} />;
  }

  // Sort highlights by startIndex in ascending order
  highlights.sort((a, b) => a.startIndex - b.startIndex);

  let lastIndex = 0;
  const content: JSX.Element[] = [];

  highlights.forEach((highlight, index) => {
    // Add the text before the highlight
    if (highlight.startIndex > lastIndex) {
      content.push(<span key={`text-${index}`} dangerouslySetInnerHTML={{ __html: segmentHtml.slice(lastIndex, highlight.startIndex) }} />);
    }
    
    // Add the highlighted text
    content.push(<span key={`highlight-${index}`} className="highlight">{highlight.text}</span>);

    lastIndex = highlight.endIndex;
  });

  // Add any remaining text after the last highlight
  if (lastIndex < segmentHtml.length) {
    content.push(<span key="remaining" dangerouslySetInnerHTML={{ __html: segmentHtml.slice(lastIndex) }} />);
  }

  return <>{content}</>;
}


// const json = {
//   id: "041c3c47-0cf2-0c64-c1a7-27dc804629ed",
//   segments: [
//     {
//       summary:
//         "Today, we announced our collaboration with Google Cloud, offering our state-of-the-art generative AI capabilities on top of BigQuery. Customers will be able to perform complex language tasks on their organizational data natively within BigQuery.",
//       segmentText:
//         "Today marks an exciting milestone as we announce our collaboration with Google Cloud, offering our state-of-the-art generative AI capabilities on top of BigQuery. \n\nOpening its annual Google Next conference, Google Cloud announced the integration of our Contextual Answers language model with its flagship BigQuery product. We are proud to be one of the first partners to integrate generative AI features on top of BigQuery, Google Cloud's fully-managed cloud data warehouse with built-in ML.\n\nThe integration will enable customers to perform complex language tasks on their organizational data natively within BigQuery. For example, retail customers can easily extract quantitative insights from product reviews, analyze attributes of successful product descriptions, and identify areas of improvement within support tickets. Financial services companies can use the integration to quickly analyze reports.",
//       segmentHtml:
//         '<p>Today marks an exciting milestone as we announce our collaboration with Google Cloud, offering our state-of-the-art generative AI capabilities on top of BigQuery. </p><span></span><p>Opening its annual Google Next conference, Google Cloud announced the integration of our <a href="https://www.ai21.com/blog/introducing-contextual-answers">Contextual Answers</a> language model with its flagship BigQuery product. We are proud to be <strong>one of the first partners to integrate generative AI features on top of BigQuery</strong>, Google Cloud&#8217;s fully-managed cloud data warehouse with built-in ML.</p><span></span><p>The integration will enable customers to perform complex language tasks on their organizational data natively within BigQuery. For example, retail customers can easily extract quantitative insights from product reviews, analyze attributes of successful product descriptions, and identify areas of improvement within support tickets. Financial services companies can use the integration to quickly analyze reports.</p><p>Today marks an exciting milestone as we announce our collaboration with Google Cloud, offering our state-of-the-art generative AI capabilities on top of BigQuery. </p><span></span><p>Opening its annual Google Next conference, Google Cloud announced the integration of our <a href="https://www.ai21.com/blog/introducing-contextual-answers">Contextual Answers</a> language model with its flagship BigQuery product. We are proud to be <strong>one of the first partners to integrate generative AI features on top of BigQuery</strong>, Google Cloud&#8217;s fully-managed cloud data warehouse with built-in ML.</p><span></span><p>The integration will enable customers to perform complex language tasks on their organizational data natively within BigQuery. For example, retail customers can easily extract quantitative insights from product reviews, analyze attributes of successful product descriptions, and identify areas of improvement within support tickets. Financial services companies can use the integration to quickly analyze reports.</p><p>Today marks an exciting milestone as we announce our collaboration with Google Cloud, offering our state-of-the-art generative AI capabilities on top of BigQuery. </p><span></span><p>Opening its annual Google Next conference, Google Cloud announced the integration of our <a href="https://www.ai21.com/blog/introducing-contextual-answers">Contextual Answers</a> language model with its flagship BigQuery product. We are proud to be <strong>one of the first partners to integrate generative AI features on top of BigQuery</strong>, Google Cloud&#8217;s fully-managed cloud data warehouse with built-in ML.</p><span></span><p>The integration will enable customers to perform complex language tasks on their organizational data natively within BigQuery. For example, retail customers can easily extract quantitative insights from product reviews, analyze attributes of successful product descriptions, and identify areas of improvement within support tickets. Financial services companies can use the integration to quickly analyze reports.</p>',
//       segmentType: "normal_text",
//       hasSummary: true,
//       highlights: [
//         {
//           text: "Today marks an exciting milestone as we announce our collaboration with Google Cloud, offering our state-of-the-art generative AI capabilities on top of BigQuery.",
//           startIndex: 0,
//           endIndex: 162,
//         },
//         {
//           text: "The integration will enable customers to perform complex language tasks on their organizational data natively within BigQuery.",
//           startIndex: 494,
//           endIndex: 620,
//         },
//       ],
//     },
//     {
//       summary: null,
//       segmentText:
//         "The integration continues our long-standing partnership with Google Cloud. As users of its custom AI accelerators and Tensor Processor Units (TPUs), we've benefited from Google Cloud's purpose-built AI infrastructure and expertise to train and serve our advanced LLMs.",
//       segmentHtml:
//         "<p>The integration continues our long-standing partnership with Google Cloud. As users of its custom AI accelerators and Tensor Processor Units (TPUs), we&#8217;ve benefited from Google Cloud&#8217;s purpose-built AI infrastructure and expertise to train and serve our advanced LLMs.<br/></p>",
//       segmentType: "normal_text_short",
//       hasSummary: false,
//       highlights: [],
//     },
//     {
//       summary:
//         "Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.",
//       segmentText: "test",
//       segmentHtml:
//         "<p>&#8220;Google Cloud&#8217;s vast portfolio of impressive AI hardware is why we chose to work with the company, and we&#8217;re proud to now double down on expanding our generative AI solutions alongside them,&#8221; said Ori Goshen, Co-CEO and co-founder, AI21 Labs. &#8220;Our partnership with Google Cloud has had a profound effect on our work to advance the possibilities of artificial intelligence and natural language processing, and today&#8217;s news of our deepened collaboration marks an important step forward in that journey.&#8221;</p>",
//       segmentType: "normal_text",
//       hasSummary: true,
//       highlights: [
//         {
//           text: "Google Cloud's vast portfolio of impressive AI hardware is why we chose to work with the company",
//           startIndex: 0,
//           endIndex: 97,
//         },
//         {
//           text: "AI21 Labs.",
//           startIndex: 232,
//           endIndex: 242,
//         },
//         {
//           text: "and today's news of our deepened collaboration marks an important step forward in that journey.",
//           startIndex: 405,
//           endIndex: 501,
//         },
//       ],
//     },
//     {
//       summary:
//         "AI21 Labs is taking advantrtfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.Google Cloud's vast portfolio of impressive AI hardware is why AI21 Labs chose to work with the company, and today's news marks an important step forward.age of Google Cloud's leading infrastructure to bring generative AI to businesses in every industry.",
//       segmentText:
//         "AI21 Labs is a leading generative AI startup that is taking advantage of the incredibAI21 Labs is a leading generative AI startup that is taking advantage of the incredibAI21 Labs is a leading generative AI startup that is taking advantage of the incredib",
//       segmentType: "normal_text",
//       hasSummary: true,
//       highlights: [
//         {
//           text: "AI21 Labs is a leading generative AI startup that is taking advantage of the incredible performance that Google Cloud's leading infrastructure offers",
//           startIndex: 0,
//           endIndex: 150,
//         },
//         {
//           text: "Our new BigQuery integrations are a great example of how we are working together to bring the value of generative AI to businesses in every industry.",
//           startIndex: 192,
//           endIndex: 343,
//         },
//       ],
//     },
//     {
//       summary:
//         "By leveraging generative AI within BigQuery, businesses can conduct quantitative analyses of their unstructured data at scale using natural language, helping them make better-informed decisions.",
//       segmentText:
//         "By unlocking the power of generative AI within BigQuery, businesses can conduct quantitative analyses of their organization's unstructured data at scale using natural language. The Contextual Answers model enables customers to easily gain deep insights that are otherwise inaccessible or difficult to extract, helping them make better-informed decisions. We can't wait to see how customers leverage generative AI capabilities within their BigQuery environment.\n\nLearn more about Contextual Answers here.",
//       segmentHtml:
//         '<p>By unlocking the power of generative AI within BigQuery, businesses can conduct quantitative analyses of their organization&#8217;s unstructured data at scale using natural language. The Contextual Answers model enables customers to easily gain deep insights that are otherwise inaccessible or difficult to extract, helping them make better-informed decisions. We can&#8217;t wait to see how customers leverage generative AI capabilities within their BigQuery environment.</p><span></span><p><em>Learn more about Contextual Answers </em><a href="https://www.ai21.com/blog/introducing-contextual-answers">here</a>.</p>',
//       segmentType: "normal_text",
//       hasSummary: true,
//       highlights: [
//         {
//           text: "By unlocking the power of generative AI within BigQuery, businesses can conduct quantitative analyses of their organization's unstructured data at scale using natural language.",
//           startIndex: 0,
//           endIndex: 176,
//         },
//         {
//           text: "helping them make better-informed decisions.",
//           startIndex: 310,
//           endIndex: 354,
//         },
//       ],
//     },
//     {
//       summary: null,
//       segmentText: "Learn more about Google Cloud's BigQuery here.",
//       segmentHtml:
//         '<p>&#8205;<em>Learn more about Google Cloud&#8217;s BigQuery </em><a href="https://cloud.google.com/bigquery#section-1">here</a>.</p>',
//       segmentType: "other",
//       hasSummary: false,
//       highlights: [],
//     },
//   ],
// };
const json = {
  "id": "cf1741dc-2f85-d259-1abf-16bc40614796",
  "segments": [
    {
      "summary": null,
      "segmentText": "Advertisement",
      "segmentHtml": "<p>Advertisement</p>",
      "segmentType": "h3",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": "SKIP ADVERTISEMENT",
      "segmentHtml": "<p><a href=\"#after-top\">SKIP ADVERTISEMENT</a></p>",
      "segmentType": "foot_note",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": "A wave of current and former staff members, mostly of a younger generation, are agitating for a cease-fire and speaking out against their bosses’ positions.",
      "segmentHtml": "<p id=\"article-summary\">A wave of current and former staff members, mostly of a younger generation, are agitating for a cease-fire and speaking out against their bosses&#8217; positions.</p>",
      "segmentType": "normal_text_short",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": "Nov. 13, 2023Updated 2:42 p.m. ET",
      "segmentHtml": "<p><time datetime=\"2023-11-13T14:42:00-05:00\"><span>Nov. 13, 2023</span><span>Updated <span>2:42 p.m. ET</span></span></time></p>",
      "segmentType": "other",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": "More than 10,000 carnations were laid on the steps at the base of the Capitol to honor civilians killed in the Israel-Hamas war. The flowers were brought over by more than 100 congressional staff members.",
      "segmentText": "The carnations arrived by the wheelbarrow. Blood-red, pink, orange and yellow, more than 10,000 stems were laid on the steps at the base of the Capitol against a clear blue sky.\n\nEach was meant to represent a civilian life lost in the Israel-Hamas war one month in, encompassing Israeli and Palestinian people alike. They were brought over by more than 100 congressional staff members, all wearing masks to obscure their identities, for a walkout last week honoring the civilians killed in the conflict and calling for a cease-fire and the release of more than 200 hostages abducted by Hamas.",
      "segmentHtml": "<p>The carnations arrived by the wheelbarrow. Blood-red, pink, orange and yellow, more than 10,000 stems were laid on the steps at the base of the Capitol against a clear blue sky.</p><span>&nbsp;&nbsp;</span><p>Each was meant to represent a civilian life lost in the Israel-Hamas war one month in, encompassing Israeli and Palestinian people alike. They were brought over by more than 100 congressional staff members, all wearing masks to obscure their identities, for a walkout last week honoring the civilians killed in the conflict and calling for a cease-fire and the release of more than 200 hostages abducted by Hamas.</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "more than 10,000 stems were laid on the steps at the base of the Capitol against a clear blue sky.",
          "startIndex": 79,
          "endIndex": 177
        },
        {
          "text": "Israel-Hamas war",
          "startIndex": 235,
          "endIndex": 251
        },
        {
          "text": "They were brought over by more than 100 congressional staff members",
          "startIndex": 317,
          "endIndex": 384
        },
        {
          "text": "honoring the civilians killed",
          "startIndex": 457,
          "endIndex": 486
        }
      ]
    },
    {
      "summary": "Three congressional aides declared they were no longer comfortable staying silent and demanded their leaders speak up and call for a cease-fire, a release of all hostages and an immediate de-escalation.",
      "segmentText": "“We are congressional staffers on Capitol Hill, and we are no longer comfortable staying silent,” three of the aides, all of whom declined to give their names, declared, the Capitol dome towering behind them. “Our constituents are pleading for a cease-fire, and we are the staffers answering their calls. Most of our bosses on Capitol Hill are not listening to the people they represent. We demand our leaders speak up: Call for a cease-fire, a release of all hostages and an immediate de-escalation now.”",
      "segmentHtml": "<p>&#8220;We are congressional staffers on Capitol Hill, and we are no longer comfortable staying silent,&#8221; three of the aides, all of whom declined to give their names, declared, the Capitol dome towering behind them. &#8220;Our constituents are pleading for a cease-fire, and we are the staffers answering their calls. Most of our bosses on Capitol Hill are not listening to the people they represent. We demand our leaders speak up: Call for a cease-fire, a release of all hostages and an immediate de-escalation now.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "and we are no longer comfortable staying silent,” three of the aides",
          "startIndex": 48,
          "endIndex": 116
        },
        {
          "text": "declared",
          "startIndex": 160,
          "endIndex": 168
        },
        {
          "text": "We demand our leaders speak up: Call for a cease-fire, a release of all hostages and an immediate de-escalation now.”",
          "startIndex": 388,
          "endIndex": 505
        }
      ]
    },
    {
      "summary": null,
      "segmentText": "The walkout was the latest in a series of actions congressional aides have taken, almost all of them anonymously, to publicly urge members of Congress — their own bosses — to call for a cease-fire in Gaza.",
      "segmentHtml": "<p>The walkout was the latest in a series of actions congressional aides have taken, almost all of them anonymously, to publicly urge members of Congress &#8212; their own bosses &#8212; to call for a cease-fire in Gaza.</p>",
      "segmentType": "normal_text_short",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": "As a tense political debate rages across the country, a more personal and emotionally fraught discussion is taking place inside the offices of members of Congress.",
      "segmentText": "As a tense political debate rages across the country and on the Senate and House floors — where elected officials have sparred over emergency aid to Israel, what if any conditions should come with it and even what language is appropriate for the debate — there is a more personal and in many ways more emotionally fraught discussion taking place inside the offices of members of Congress.",
      "segmentHtml": "<p>As a tense political debate rages across the country and on the Senate and House floors &#8212; where elected officials have sparred over <a title=\"\" href=\"https://www.nytimes.com/2023/10/31/us/politics/israel-aid-republicans-mike-johnson.html\">emergency aid to Israel</a>, what if any <a title=\"\" href=\"https://www.nytimes.com/2023/11/08/us/politics/senate-democrats-biden-israel.html\">conditions should come with it</a> and even <a title=\"\" href=\"https://www.nytimes.com/2023/11/09/us/politics/river-to-the-sea-israel-gaza-palestinians.html\">what language is appropriate for the debate</a> &#8212; there is a more personal and in many ways more emotionally fraught discussion taking place inside the offices of members of Congress.</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "As a tense political debate rages across the country and on the Senate and House floors — where elected officials have sparred over emergency aid to Israel, what if any conditions should come with it and even what language is appropriate for the debate — there is a more personal and in many ways more emotionally fraught discussion taking place inside the offices of members of Congress.",
          "startIndex": 0,
          "endIndex": 388
        }
      ]
    },
    {
      "summary": "The vast majority of lawmakers in both political parties have rejected calls for a cease-fire, saying a cessation would embolden Hamas and allow it to regroup.",
      "segmentText": "The vast majority of lawmakers in both political parties have rejected calls for a cease-fire, saying Israel has a right to go after Hamas after its brutal attack in southern Israel, in which 1,200 people were killed and more than 200 taken hostage. A cessation, many of them argue, would only embolden Hamas and allow it to regroup. Israel announced last week that it would institute daily combat pauses to allow civilians to flee and aid to enter Gaza amid skyrocketing civilian casualties and a worsening humanitarian crisis.",
      "segmentHtml": "<p>The vast majority of lawmakers in both political parties have rejected calls for a cease-fire, saying Israel has a right to go after Hamas after its brutal attack in southern Israel, in which <a title=\"\" href=\"https://www.nytimes.com/live/2023/11/10/world/israel-hamas-war-gaza-news/israel-lowers-its-official-oct-7-death-toll-to-1200?smid=url-share\">1,200 people were killed</a> and more than 200 taken hostage. A cessation, many of them argue, would only embolden Hamas and allow it to regroup. Israel announced last week that <a title=\"\" href=\"https://www.nytimes.com/live/2023/11/09/world/israel-hamas-war-gaza\">it would institute daily combat pauses</a> to allow civilians to flee and aid to enter Gaza amid skyrocketing civilian casualties and a worsening humanitarian crisis.</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "The vast majority of lawmakers in both political parties have rejected calls for a cease-fire",
          "startIndex": 0,
          "endIndex": 93
        },
        {
          "text": "A cessation",
          "startIndex": 250,
          "endIndex": 261
        },
        {
          "text": "would only embolden Hamas and allow it to regroup.",
          "startIndex": 283,
          "endIndex": 333
        }
      ]
    },
    {
      "summary": "Many Democratic congressional staff members are in stark disagreement with their bosses and the Biden administration on an issue that cuts to the heart of their values.",
      "segmentText": "But many Democratic congressional staff members, most of them under the age of 35, have found themselves in stark disagreement with their bosses and the Biden administration on an issue that cuts to the heart of their values, according to interviews with more than a dozen aides and strategists, most of whom spoke on the condition that their names not be used for fear of imperiling their jobs and prompting personal attacks.",
      "segmentHtml": "<p>But many Democratic congressional staff members, most of them under the age of 35, have found themselves in stark disagreement with their bosses and the Biden administration on an issue that cuts to the heart of their values, according to interviews with more than a dozen aides and strategists, most of whom spoke on the condition that their names not be used for fear of imperiling their jobs and prompting personal attacks.</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "But many Democratic congressional staff members",
          "startIndex": 0,
          "endIndex": 47
        },
        {
          "text": "have found themselves in stark disagreement with their bosses and the Biden administration on an issue that cuts to the heart of their values",
          "startIndex": 83,
          "endIndex": 224
        }
      ]
    },
    {
      "summary": "Many aides on Capitol Hill have voiced dissenting opinions in internal meetings and on calls with constituents, and have concluded that they have no choice but to speak out.",
      "segmentText": "They say they have struggled to reconcile their personal convictions with their professional obligations, which by definition require that they keep their opinions to themselves and zealously advocate the position of the member of Congress who employs them. They have voiced their dissenting opinions in internal meetings and grappled with what to say on calls with constituents.\n\nAnd many have concluded that they have no choice but to speak out — albeit most without using their names — in a remarkably open break from the cardinal Capitol Hill rule that holds that aides should stay in the background and never publicly contradict the boss.",
      "segmentHtml": "<p>They say they have struggled to reconcile their personal convictions with their professional obligations, which by definition require that they keep their opinions to themselves and zealously advocate the position of the member of Congress who employs them. They have voiced their dissenting opinions in internal meetings and grappled with what to say on calls with constituents.</p><span>&nbsp;&nbsp;</span><p>And many have concluded that they have no choice but to speak out &#8212; albeit most without using their names &#8212; in a remarkably open break from the cardinal Capitol Hill rule that holds that aides should stay in the background and never publicly contradict the boss.</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "They have voiced their dissenting opinions in internal meetings and grappled with what to say on calls with constituents.\n\nAnd many have concluded that they have no choice but to speak out — albeit most without using their names — in a remarkably open break from the cardinal Capitol Hill rule that holds that aides should stay in the background and never publicly contradict the boss.",
          "startIndex": 258,
          "endIndex": 643
        }
      ]
    },
    {
      "summary": "For a lot of people, this is a red line, but the conversation on Capitol Hill is divorced from reality, said Jeremy Slevin, a senior adviser to Representative Ilhan Omar.",
      "segmentText": "“For a lot of people, this is a real red line,” said Jeremy Slevin, a senior adviser to Representative Ilhan Omar, a Minnesota Democrat who is among the few members of Congress in her party to have called for a cease-fire. “It’s so horrific what’s happening, and it’s so elemental to be able to oppose the bombing of a refugee camp, for example. And it feels like the conversation up here on Capitol Hill, it’s totally divorced from reality — from the reality on the ground in Israel and Gaza, but also from the reality of the views of their own constituents and staffers.”",
      "segmentHtml": "<p>&#8220;For a lot of people, this is a real red line,&#8221; said Jeremy Slevin, a senior adviser to Representative Ilhan Omar, a Minnesota Democrat who is among the few members of Congress in her party to have called for a cease-fire. &#8220;It&#8217;s so horrific what&#8217;s happening, and it&#8217;s so elemental to be able to oppose the bombing of a refugee camp, for example. And it feels like the conversation up here on Capitol Hill, it&#8217;s totally divorced from reality &#8212; from the reality on the ground in Israel and Gaza, but also from the reality of the views of their own constituents and staffers.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "“For a lot of people, this is a real red line,” said Jeremy Slevin, a senior adviser to Representative Ilhan Omar",
          "startIndex": 0,
          "endIndex": 113
        },
        {
          "text": "And it feels like the conversation up here on Capitol Hill",
          "startIndex": 346,
          "endIndex": 404
        },
        {
          "text": "divorced from reality",
          "startIndex": 419,
          "endIndex": 440
        }
      ]
    },
    {
      "summary": "Most lawmakers in both political parties are staunchly pro-Israel, but some Democratic congressional aides have been outspoken on the record about their defense of Israel, in contrast with their co-workers who are challenging their bosses and who have generally felt compelled to stay publicly anonymous.",
      "segmentText": "Most lawmakers in both political parties are staunchly pro-Israel. There is typically little tolerance on Capitol Hill for harsh criticism of the Jewish state, which some members of Congress — particularly conservative Republicans — almost reflexively brand as antisemitic.\n\nSome Democratic congressional aides have been outspoken on the record about their defense of Israel, in contrast with their co-workers who are challenging their bosses and who have generally felt compelled to stay publicly anonymous.\n\nAdam Jentleson, the chief of staff for Senator John Fetterman of Pennsylvania, recently wrote on X: “hamas just *broke a ceasefire* to slaughter innocents. some think hamas will now magically abide by a ceasefire. some of us think this is unrealistic & offers up more innocents for slaughter.”\n\nMr. Fetterman, a progressive Democrat, has vocally defended Israel and supported humanitarian pauses, but not a cease-fire.\n\nIn an email to staff members in late October, Mr. Jentleson reminded aides that while they were permitted to sign open letters anonymously, social media posts or comments that contradicted the senator’s positions were “prohibited.”\n\n“You cannot use your status as a current Fetterman staffer to undermine John’s positions or otherwise make a public statement that is inconsistent with John’s views,” Mr. Jentleson wrote, adding, “As the saying goes, our names are not on the door.”",
      "segmentHtml": "<p>Most lawmakers in both political parties are staunchly pro-Israel. There is typically little tolerance on Capitol Hill for harsh criticism of the Jewish state, which some members of Congress &#8212; particularly conservative Republicans &#8212; almost reflexively brand as antisemitic.</p><span>&nbsp;&nbsp;</span><p>Some Democratic congressional aides have been outspoken on the record about their defense of Israel, in contrast with their co-workers who are challenging their bosses and who have generally felt compelled to stay publicly anonymous.</p><span>&nbsp;&nbsp;</span><p>Adam Jentleson, the chief of staff for Senator John Fetterman of Pennsylvania, recently <a rel=\"noopener noreferrer\" title=\"\" href=\"https://twitter.com/AJentleson/status/1715795643627696603\">wrote on X</a>: &#8220;hamas just *broke a ceasefire* to slaughter innocents. some think hamas will now magically abide by a ceasefire. some of us think this is unrealistic &amp; offers up more innocents for slaughter.&#8221;</p><span>&nbsp;&nbsp;</span><p>Mr. Fetterman, a progressive Democrat, has vocally defended Israel and supported humanitarian pauses, but not a cease-fire.</p><span>&nbsp;&nbsp;</span><p>In <a rel=\"noopener noreferrer\" title=\"\" href=\"https://twitter.com/the_vello/status/1716545265761468813\">an email to staff members</a> in late October, Mr. Jentleson reminded aides that while they were permitted to sign open letters anonymously, social media posts or comments that contradicted the senator&#8217;s positions were &#8220;prohibited.&#8221;</p><span>&nbsp;&nbsp;</span><p>&#8220;You cannot use your status as a current Fetterman staffer to undermine John&#8217;s positions or otherwise make a public statement that is inconsistent with John&#8217;s views,&#8221; Mr. Jentleson wrote, adding, &#8220;As the saying goes, our names are not on the door.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "Most lawmakers in both political parties are staunchly pro-Israel.",
          "startIndex": 0,
          "endIndex": 66
        },
        {
          "text": "Some Democratic congressional aides have been outspoken on the record about their defense of Israel, in contrast with their co-workers who are challenging their bosses and who have generally felt compelled to stay publicly anonymous.",
          "startIndex": 275,
          "endIndex": 508
        }
      ]
    },
    {
      "summary": "Staffers on Capitol Hill are divided over how far to go in criticizing Israel's military campaign.",
      "segmentText": "Aides typically play a significant behind-the-scenes role in advising and guiding lawmakers’ policy positions. But the large public displays of disagreement, including last week’s walkout at the Capitol and a wave of open letters to lawmakers, reflect a profound generational divide among Democrats about how far to go in criticizing Israel’s military campaign.\n\n“I can’t think of a similar or comparable effort by staff,” said Mr. Slevin, who has worked in various jobs on Capitol Hill for the better part of a decade. “It’s unlike anything we’ve ever seen.”",
      "segmentHtml": "<p>Aides typically play a significant behind-the-scenes role in advising and guiding lawmakers&#8217; policy positions. But the large public displays of disagreement, including last week&#8217;s walkout at the Capitol and a wave of open letters to lawmakers, reflect a profound generational divide among Democrats about how far to go in criticizing Israel&#8217;s military campaign.</p><span>&nbsp;&nbsp;</span><p>&#8220;I can&#8217;t think of a similar or comparable effort by staff,&#8221; said Mr. Slevin, who has worked in various jobs on Capitol Hill for the better part of a decade. &#8220;It&#8217;s unlike anything we&#8217;ve ever seen.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "reflect a profound generational divide among Democrats about how far to go in criticizing Israel’s military campaign.",
          "startIndex": 244,
          "endIndex": 361
        },
        {
          "text": "on Capitol Hill",
          "startIndex": 471,
          "endIndex": 486
        }
      ]
    },
    {
      "summary": "Hundreds of staff members have signed letters calling on members of Congress to endorse a cease-fire. The letters accuse lawmakers of ignoring the plight of Palestinian civilians killed in Israel's military campaign while focusing intently on the Israeli civilians killed and taken hostage in Hamas's attack on Oct. 7.",
      "segmentText": "In the last few weeks, hundreds of staff members have signed on to letters calling on members of Congress to endorse a cease-fire. Dozens have appeared at pro-Palestinian demonstrations, including one steps from the White House where some hoisted signs that read, “Congress, your staff demands a cease-fire.”\n\n“The voices of members of Congress hold immense power — we have seen it firsthand,” read one such open letter, which was led by Jewish and Muslim aides and signed by more than 550 staff members as of Nov. 9. “We now ask them to use that power to protect civilians in imminent danger.”\n\nThe signers accused lawmakers of ignoring the plight of Palestinian civilians killed in Israel’s military campaign while focusing intently on the Israeli civilians killed and taken hostage in Hamas’s attack on Oct. 7. The health ministry in Gaza, which is controlled by Hamas, estimates that 11,000 civilians have been killed there over the last month.\n\n“We have appreciated seeing nearly every member of Congress express quick and unequivocal solidarity with the Israeli people,” the letter said, “but we are profoundly disturbed that such shows of humanity have barely been extended to the Palestinian people.”",
      "segmentHtml": "<p>In the last few weeks, hundreds of staff members have signed on to letters calling on members of Congress to endorse a cease-fire. Dozens have appeared at pro-Palestinian demonstrations, <a title=\"\" href=\"https://www.nytimes.com/2023/11/04/us/protests-israels-gaza.html\">including one steps from the White House</a> where some hoisted signs that read, &#8220;Congress, your staff demands a cease-fire.&#8221;</p><span>&nbsp;&nbsp;</span><p>&#8220;The voices of members of Congress hold immense power &#8212; we have seen it firsthand,&#8221; read <a rel=\"noopener noreferrer\" title=\"\" href=\"https://static01.nyt.com/newsgraphics/documenttools/6c72092528f2db9a/9b7b5f7b-full.pdf\">one such open letter</a>, which was led by Jewish and Muslim aides and signed by more than 550 staff members as of Nov. 9. &#8220;We now ask them to use that power to protect civilians in imminent danger.&#8221;</p><span>&nbsp;&nbsp;</span><p>The signers accused lawmakers of ignoring the plight of Palestinian civilians killed in Israel&#8217;s military campaign while focusing intently on the Israeli civilians killed and taken hostage in Hamas&#8217;s attack on Oct. 7. The health ministry in Gaza, which is controlled by Hamas, estimates that 11,000 civilians have been killed there over the last month.</p><span>&nbsp;&nbsp;</span><p>&#8220;We have appreciated seeing nearly every member of Congress express quick and unequivocal solidarity with the Israeli people,&#8221; the letter said, &#8220;but we are profoundly disturbed that such shows of humanity have barely been extended to the Palestinian people.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "hundreds of staff members have signed on to letters calling on members of Congress to endorse a cease-fire.",
          "startIndex": 23,
          "endIndex": 130
        },
        {
          "text": "The signers accused lawmakers of ignoring the plight of Palestinian civilians killed in Israel’s military campaign while focusing intently on the Israeli civilians killed and taken hostage in Hamas’s attack on Oct. 7.",
          "startIndex": 596,
          "endIndex": 813
        }
      ]
    },
    {
      "summary": null,
      "segmentText": "The signers wrote that they were staying anonymous “out of concern for our personal safety, risk of violence and the impact on our professional credibility on Capitol Hill.”",
      "segmentHtml": "<p>The signers wrote that they were staying anonymous &#8220;out of concern for our personal safety, risk of violence and the impact on our professional credibility on Capitol Hill.&#8221;</p>",
      "segmentType": "normal_text_short",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": "500 former staff members of President Biden's 2020 campaign wrote an open letter calling for a cease-fire.",
      "segmentText": "Around the same time, 500 former staff members on President Biden’s 2020 campaign, calling themselves Biden Alumni for Peace and Justice, wrote an open letter calling for a cease-fire. “If you fail to act swiftly,” they warned, “your legacy will be complicity in the face of genocide.”",
      "segmentHtml": "<p>Around the same time, 500 former staff members on President Biden&#8217;s 2020 campaign, calling themselves Biden Alumni for Peace and Justice, <a rel=\"noopener noreferrer\" title=\"\" href=\"https://medium.com/@bidenalumnipeace/dear-president-biden-8a41e0b444dd\">wrote an open letter</a> calling for a cease-fire. &#8220;If you fail to act swiftly,&#8221; they warned, &#8220;your legacy will be complicity in the face of genocide.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "500 former staff members on President Biden’s 2020 campaign",
          "startIndex": 22,
          "endIndex": 81
        },
        {
          "text": "wrote an open letter calling for a cease-fire.",
          "startIndex": 138,
          "endIndex": 184
        }
      ]
    },
    {
      "summary": "More than 400 former staff members signed a letter to Senator Elizabeth Warren and Senator Bernie Sanders calling for a cease-fire.",
      "segmentText": "More than 400 former staff members from Senator Elizabeth Warren’s 2020 campaign signed a similar letter to the Massachusetts Democrat, as did 400 former aides to Senator Bernie Sanders’s 2016 and 2020 campaigns.\n\nMr. Sanders, a Vermont independent, has rejected calls for a cease-fire. Both he and Ms. Warren have called for pauses to allow humanitarian aid to get to civilians.",
      "segmentHtml": "<p>More than 400 former staff members from Senator Elizabeth Warren&#8217;s 2020 campaign <a rel=\"noopener noreferrer\" title=\"\" href=\"https://medium.com/@warrenstaff4peace/dear-senator-warren-9a8055d97f2f\">signed a similar letter</a> to the Massachusetts Democrat, <a rel=\"noopener noreferrer\" title=\"\" href=\"https://medium.com/@formerberniestaff/open-letter-to-senator-bernie-sanders-9d1c10d99e99\">as did 400 former aides</a> to Senator Bernie Sanders&#8217;s 2016 and 2020 campaigns.</p><span>&nbsp;&nbsp;</span><p>Mr. Sanders, a Vermont independent, has rejected calls for a cease-fire. Both he and Ms. Warren have called for pauses to allow humanitarian aid to get to civilians.</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "More than 400 former staff members from Senator Elizabeth Warren’s 2020 campaign signed a similar letter to the Massachusetts Democrat",
          "startIndex": 0,
          "endIndex": 134
        },
        {
          "text": "Senator Bernie Sanders",
          "startIndex": 163,
          "endIndex": 185
        },
        {
          "text": "has rejected calls for a cease-fire.",
          "startIndex": 250,
          "endIndex": 286
        }
      ]
    },
    {
      "summary": "Ms. Warren said she is proud of people who fight for what they believe in, and that she is blessed to have people to work with who are smart, hardworking and passionate.",
      "segmentText": "“I am very proud of people who fight for what they believe in,” Ms. Warren said in a brief interview. “It’s something that my former staffers and I have shared in the trenches for years.”\n\nShe sidestepped a question about whether she had discussed a cease-fire with her current aides. There was “a very collegial give and take in our office on a very wide range of issues all the time,” Ms. Warren said. “I’m blessed to have people to work with who are smart, hardworking and passionate.”",
      "segmentHtml": "<p>&#8220;I am very proud of people who fight for what they believe in,&#8221; Ms. Warren said in a brief interview. &#8220;It&#8217;s something that my former staffers and I have shared in the trenches for years.&#8221;</p><span>&nbsp;&nbsp;</span><p>She sidestepped a question about whether she had discussed a cease-fire with her current aides. There was &#8220;a very collegial give and take in our office on a very wide range of issues all the time,&#8221; Ms. Warren said. &#8220;I&#8217;m blessed to have people to work with who are smart, hardworking and passionate.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "“I am very proud of people who fight for what they believe in,” Ms. Warren said in a brief interview.",
          "startIndex": 0,
          "endIndex": 101
        },
        {
          "text": "“I’m blessed to have people to work with who are smart, hardworking and passionate.”",
          "startIndex": 404,
          "endIndex": 488
        }
      ]
    },
    {
      "summary": "The debate over a cease-fire between Israel and Hamas has gotten hotter and messier in other congressional offices. Adam Ramer resigned after less than a week on the job when Representative Ro Khanna declined to call for a cease-fire.",
      "segmentText": "The debate has gotten hotter and messier in other congressional offices. Adam Ramer, who was the political director to Representative Ro Khanna, Democrat of California, resigned after less than a week on the job when the congressman declined to call for a cease-fire.\n\nMr. Khanna urged Israel to “stop the bombing of civilians,” but said he did not support a cease-fire because Israel had a legitimate interest in stamping out Hamas. He said that there were a range of opinions within his office, but that his obligation was to his constituents.\n\n“I respect their conviction and passion, but we’re a country of 330 million people, and their voice is as one of those citizens,” Mr. Khanna said in an interview. “A congressperson is accountable to hundreds of thousands in their district.”",
      "segmentHtml": "<p>The debate has gotten hotter and messier in other congressional offices. Adam Ramer, who was the political director to Representative Ro Khanna, Democrat of California, <a rel=\"noopener noreferrer\" title=\"\" href=\"https://www.newyorker.com/news/the-political-scene/how-israel-is-splitting-the-democrats\">resigned after less than a week on the job</a> when the congressman declined to call for a cease-fire.</p><span>&nbsp;&nbsp;</span><p>Mr. Khanna urged Israel to &#8220;stop the bombing of civilians,&#8221; but said he did not support a cease-fire because Israel had a legitimate interest in stamping out Hamas. He said that there were a range of opinions within his office, but that his obligation was to his constituents.</p><span>&nbsp;&nbsp;</span><p>&#8220;I respect their conviction and passion, but we&#8217;re a country of 330 million people, and their voice is as one of those citizens,&#8221; Mr. Khanna said in an interview. &#8220;A congressperson is accountable to hundreds of thousands in their district.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "The debate has gotten hotter and messier in other congressional offices. Adam Ramer, who was the political director to Representative Ro Khanna",
          "startIndex": 0,
          "endIndex": 143
        },
        {
          "text": "resigned after less than a week on the job when the congressman declined to call for a cease-fire.",
          "startIndex": 169,
          "endIndex": 267
        },
        {
          "text": "” but said he did not support a cease-fire because Israel had a legitimate interest in stamping out Hamas.",
          "startIndex": 327,
          "endIndex": 433
        }
      ]
    },
    {
      "summary": "Aides acknowledge that it's rare to find a member of Congress they align with on all policy issues, but the Israel-Hamas conflict has left them feeling ashamed of their work.",
      "segmentText": "Aides acknowledged that it was rare, if not impossible, to find a member of Congress they aligned with on all policy issues. But they argue that the Israel-Hamas conflict has been particularly agonizing, leaving them feeling ashamed of their work.\n\n“A lot of staffers feel like they live in an upside-down world,” said Waleed Shahid, a progressive strategist and former Capitol Hill aide. “They have to go into work and put their heads down, and just write a statement or release a statement from their boss that they absolutely in the core of their being disagree with.”",
      "segmentHtml": "<p>Aides acknowledged that it was rare, if not impossible, to find a member of Congress they aligned with on all policy issues. But they argue that the Israel-Hamas conflict has been particularly agonizing, leaving them feeling ashamed of their work.</p><span>&nbsp;&nbsp;</span><p>&#8220;A lot of staffers feel like they live in an upside-down world,&#8221; said Waleed Shahid, a progressive strategist and former Capitol Hill aide. &#8220;They have to go into work and put their heads down, and just write a statement or release a statement from their boss that they absolutely in the core of their being disagree with.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "Aides acknowledged that it was rare",
          "startIndex": 0,
          "endIndex": 35
        },
        {
          "text": "to find a member of Congress they aligned with on all policy issues. But they argue that the Israel-Hamas conflict has been particularly agonizing, leaving them feeling ashamed of their work.",
          "startIndex": 56,
          "endIndex": 247
        }
      ]
    },
    {
      "summary": "A staff member for a Democratic congresswoman who has not called for a cease-fire said she had fielded hundreds of messages from constituents, but was rebuffed when she raised the issue directly with the congresswoman.",
      "segmentText": "One staff member for a Democratic congresswoman who has not called for a cease-fire said that she had fielded hundreds of messages from constituents since Hamas’s attack and Israel’s bombardment of Gaza, and that the vast majority had been supportive of a cease-fire.\n\nWhen the aide tried to tell senior staff members, she said she was rebuffed. When she raised the issue directly with the congresswoman, warning that constituents were saying they would not support her in 2024 if she did not call for a cease-fire, the staff member said she was reprimanded by a superior.\n\nShe described feeling nauseous at work and crying at the office.",
      "segmentHtml": "<p>One staff member for a Democratic congresswoman who has not called for a cease-fire said that she had fielded hundreds of messages from constituents since Hamas&#8217;s attack and Israel&#8217;s bombardment of Gaza, and that the vast majority had been supportive of a cease-fire.</p><span>&nbsp;&nbsp;</span><p>When the aide tried to tell senior staff members, she said she was rebuffed. When she raised the issue directly with the congresswoman, warning that constituents were saying they would not support her in 2024 if she did not call for a cease-fire, the staff member said she was reprimanded by a superior.</p><span>&nbsp;&nbsp;</span><p>She described feeling nauseous at work and crying at the office.</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "One staff member for a Democratic congresswoman who has not called for a cease-fire said that she had fielded hundreds of messages from constituents since Hamas’s attack and Israel’s bombardment of Gaza",
          "startIndex": 0,
          "endIndex": 202
        },
        {
          "text": "she said she was rebuffed. When she raised the issue directly with the congresswoman",
          "startIndex": 319,
          "endIndex": 403
        }
      ]
    },
    {
      "summary": "Mr. Shahid said the discord was the result of a generational disconnect between the old guard of the Democratic Party and new generation of Democratic voters.",
      "segmentText": "Mr. Shahid said the discord was the result of a generational disconnect that could hurt Democrats electorally in 2024.\n\n“The old guard of the Democratic Party has an outdated view of how unconditionally supportive their own voters are of Israel,” he said. “There’s a new generation of Democratic voters and electeds who want to be a bit more evenhanded when it comes to treating Israeli lives and Palestinian lives equally.”",
      "segmentHtml": "<p>Mr. Shahid said the discord was the result of a generational disconnect that could hurt Democrats electorally in 2024.</p><span>&nbsp;&nbsp;</span><p>&#8220;The old guard of the Democratic Party has an outdated view of how unconditionally supportive their own voters are of Israel,&#8221; he said. &#8220;There&#8217;s a new generation of Democratic voters and electeds who want to be a bit more evenhanded when it comes to treating Israeli lives and Palestinian lives equally.&#8221;</p>",
      "segmentType": "normal_text",
      "hasSummary": true,
      "highlights": [
        {
          "text": "Mr. Shahid said the discord was the result of a generational disconnect that could hurt Democrats electorally in 2024.",
          "startIndex": 0,
          "endIndex": 118
        },
        {
          "text": "old guard of the Democratic Party",
          "startIndex": 125,
          "endIndex": 158
        },
        {
          "text": "new generation of Democratic voters",
          "startIndex": 267,
          "endIndex": 302
        }
      ]
    },
    {
      "summary": null,
      "segmentText": "A version of this article appears in print on  , Section ",
      "segmentHtml": "<p>A version of this article appears in print on <span>&#160;</span>, Section </p>",
      "segmentType": "normal_text_short",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": "A",
      "segmentHtml": "<p>A</p>",
      "segmentType": "h3",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": ", Page ",
      "segmentHtml": "<p>, Page </p>",
      "segmentType": "other",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": "14",
      "segmentHtml": "<p>14</p>",
      "segmentType": "other",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": " of the New York edition",
      "segmentHtml": "<p> of the New York edition</p>",
      "segmentType": "other",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": " with the headline: ",
      "segmentHtml": "<p> with the headline: </p>",
      "segmentType": "normal_text_short",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": "Congressional Aides Break With Bosses Over the Israel-Hamas War. Order Reprints | Today’s Paper | Subscribe",
      "segmentHtml": "<p>Congressional Aides Break With Bosses Over the Israel-Hamas War<span>. <a href=\"https://www.parsintl.com/publication/the-new-york-times/\">Order Reprints</a> | <a href=\"https://www.nytimes.com/section/todayspaper\">Today&#8217;s Paper</a> | <a href=\"https://www.nytimes.com/subscriptions/Multiproduct/lp8HYKU.html?campaignId=48JQY\">Subscribe</a></span></p>",
      "segmentType": "other",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": "Advertisement",
      "segmentHtml": "<p>Advertisement</p>",
      "segmentType": "h3",
      "hasSummary": false,
      "highlights": []
    },
    {
      "summary": null,
      "segmentText": "SKIP ADVERTISEMENT",
      "segmentHtml": "<p><a href=\"#after-bottom\">SKIP ADVERTISEMENT</a></p>",
      "segmentType": "foot_note",
      "hasSummary": false,
      "highlights": []
    }
  ]
}

export function Dashboard() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeSegment, setActiveSegment] = useState(0);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleMinimize = () => setIsMinimized(!isMinimized);

  useEffect(() => {
    const currentSegmentRef = segmentRefs.current[activeSegment];
    if (currentSegmentRef) {
      currentSegmentRef.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeSegment]);

  return (
    <div className="flex flex-col h-screen">
      <section className="w-full h-12 bg-stone-400 text-white flex items-center justify-center">
        <h1 className="text-xl font-bold">Dashboard</h1>
      </section>
      <div className="flex flex-1 divide-x overflow-auto">
        {/* Left Side - Summaries */}
        <div
          className={clsx("flex flex-col", {
            "w-1/3": isMinimized,
            "w-1/2": !isMinimized,
          })}
        >
          <div className="w-full flex justify-between items-center p-4 bg-gray-100 cursor-pointer">
            <h2 className="text-lg font-semibold">Section 1</h2>
            <button onClick={toggleMinimize}>
              {isMinimized ? (
                <ArrowsPointingOutIcon className="h-6 w-6" />
              ) : (
                <ArrowsPointingInIcon className="h-6 w-6" />
              )}
            </button>
          </div>
          <div className="overflow-y-auto">
            {json.segments.map((segment, index) => (
              <div
                key={index}
                onClick={() => setActiveSegment(index)}
                className="p-4 cursor-pointer hover:bg-gray-200"
              >
                {segment.summary || "No Summary Available"}
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Full Content */}
        <div
          className={clsx(
            "flex flex-col transition-all duration-500 ease-in-out",
            {
              "w-3/4": isMinimized,
              "w-1/2": !isMinimized,
            }
          )}
        >
          <div className="w-full flex justify-between items-center p-4 bg-gray-100 cursor-pointer">
            <h2 className="text-lg font-semibold">Section 2</h2>
          </div>
          <div className="px-4 py-8 md:py-12 overflow-y-auto">
            <div className="mx-auto space-y-10 max-w-prose prose">
              <article>
                {json.segments.map((segment, index) => (
                  <div
                    key={index}
                    ref={(el) => (segmentRefs.current[index] = el)}
                    className="p-4 prose lg:prose-lg"
                  >
                    {/* {parse( */}
                      {applyHighlights(segment.segmentHtml ?? "", segment.highlights)}
                    {/* )} */}
                  </div>
                ))}
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// export function Dashboard() {
//   const [isMinimized, setIsMinimized] = useState(false);
//   const [activeSegment, setActiveSegment] = useState(0);

//   const toggleMinimize = () => setIsMinimized(!isMinimized);

//   return (
//     <div className="flex flex-col h-screen">
//       <section className="w-full h-12 bg-stone-400 text-white flex items-center justify-center">
//         <h1 className="text-xl font-bold">Dashboard</h1>
//       </section>
//       <div className="flex flex-1 divide-x">
//         {/* Left Side - Summaries */}
//         <div
//           className={clsx(
//             "flex flex-col overflow-auto transition-all duration-500 ease-in-out",
//             {
//               "w-1/3": isMinimized,
//               "w-1/2": !isMinimized,
//             }
//           )}
//         >
//           <div className="w-full flex justify-between items-center p-4 bg-gray-100 cursor-pointer">
//             <h2 className="text-lg font-semibold">Section 1</h2>
//             <button onClick={toggleMinimize}>
//               {isMinimized ? (
//                 <ArrowsPointingOutIcon className="h-6 w-6" />
//               ) : (
//                 <ArrowsPointingInIcon className="h-6 w-6" />
//               )}
//             </button>
//           </div>
//           {json.segments.map((segment, index) => (
//             <div
//               key={index}
//               onClick={() => setActiveSegment(index)}
//               className="p-4 cursor-pointer hover:bg-gray-200"
//             >
//               {segment.summary || "No Summary Available"}
//             </div>
//           ))}
//         </div>

//         {/* Right Side - Full Content */}
//         <div
//           className={clsx(
//             "flex flex-col overflow-auto transition-all duration-500 ease-in-out",
//             {
//               "w-3/4": isMinimized,
//               "w-1/2": !isMinimized,
//             }
//           )}
//         >
//           <div className="w-full flex justify-between items-center p-4 bg-gray-100 cursor-pointer">
//             <h2 className="text-lg font-semibold">Section 2</h2>
//           </div>
//           <div className="p-4">
//             {parse(json.segments[activeSegment].segmentHtml ?? "")}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export function Dashboard() {
//   const [isMinimized, setIsMinimized] = useState(false);

//   const toggleMinimize = () => setIsMinimized(!isMinimized);

//   return (
//     <div className="flex flex-col h-screen">
//       <section className="w-full h-12 bg-stone-400 text-white flex items-center justify-center">
//         <h1 className="text-xl font-bold">Dashboard</h1>
//       </section>
//       <div className="flex flex-1 divide-x">
//         <div className={clsx("flex flex-col transition-all duration-500 ease-in-out", {
//             "w-1/3": isMinimized,
//             "w-1/2": !isMinimized,
//           })}>
// <div className="w-full flex justify-between items-center p-4 bg-gray-100 cursor-pointer">
//   <h2 className="text-lg font-semibold">Section 1</h2>
//   <button onClick={toggleMinimize}>
//     {isMinimized ? <ArrowsPointingOutIcon className="h-6 w-6" /> : <ArrowsPointingInIcon className="h-6 w-6" />}
//   </button>
// </div>
//           <div className="p-4 flex-grow">
//             <p>Content for section 1.</p>
//           </div>
//         </div>
//         <div className={clsx("flex flex-col transition-all duration-500 ease-in-out", {
//             "w-3/4": isMinimized,
//             "w-1/2": !isMinimized,
//           })}>
// <div className="w-full flex justify-between items-center p-4 bg-gray-100 cursor-pointer">
//   <h2 className="text-lg font-semibold">Section 2</h2>
// </div>
//           <div className="p-4 flex-grow">
//             <p>Content for section 2.</p>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }
