# SMRY.ai

**SMRY.ai**: Revolutionizing article reading and paywall bypass with the power of AI. This tool generates summaries and gets past hard to avoid paywalls by using archive.org, googlebot, and (soon) archive.is, harnessing the advanced capabilities of OpenAI's ChatGPT API and the Vercel AI SDK. Experience seamless streaming and real-time responses with our edge computing approach.

## How it Works
SMRY.ai integrates the [ChatGPT API](https://openai.com/api/) with the [Vercel AI SDK](https://sdk.vercel.ai/docs) to offer a streamlined, efficient summary generation process. By utilizing edge streaming, we ensure fast, responsive interactions. For insights into similar technologies, explore [RSC With Streaming](https://rsc-llm-on-the-edge.vercel.app/).

## Running Locally
To run SMRY.ai in your local environment:

1. **Clone the Repository:** Start by cloning the repo to your local machine.
2. **Set Up Environment Variables:**
   - Navigate to [OpenAI](https://beta.openai.com/account/api-keys) to obtain your API key.
   - Create a `.env` file in your project root based on the `.env.example` provided.
   - Ensure you have valid Vercel/Upstash KV keys. Optionally, acquire Resend Labs keys from [Resend](https://resend.com).
3. **Installation:**
   - Run `pnpm install` to install the necessary dependencies.
4. **Starting the Application:**
   - Execute `pnpm run dev` to start the application.
   - Access the application at `http://localhost:3000`.

## Requirements
- [PNPM](https://pnpm.io/) package manager

## Contributing
Contributions are VERY welcome! 

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Contact
For support or queries, reach out to me at [contact@smry.ai].

## Acknowledgements
Special thanks to any contributors who make the ui nicer or the paywall bypass more robust. Really curious if we can make the best such open source tool!

---

### MIT License Section for README

```markdown
## License

MIT License

Copyright (c) 20XX [Your Name or Organization]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```# smry-ai
