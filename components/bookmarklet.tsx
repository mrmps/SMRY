export const BookmarkletComponent = () => {

    const handleDragStart = (event: { dataTransfer: { setData: (arg0: string, arg1: string) => void; }; }) => {
        event.dataTransfer.setData('text/plain', "javascript:(function(){window.location.href='https://smry.ai/'+window.location.href;})();");
      };
  return (
    <section className="hidden sm:block relative z-0 mt-16 bg-gray-100 rounded-xl shadow-sm border-zinc-200 hover:bg-black transition-all duration-500">
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-4 rounded-xl">
        <div className="text-center">
          <div
            className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 items-center justify-center text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900 hover:text-white before:absolute before:inset-0 before:rounded-xl hover:before:bg-black before:-z-10 before:transition-colors before:duration-500 group"
          >
            <span className="relative p-0.5 rounded-full bg-slate-200 group-hover:bg-black transition duration-500 overflow-hidden flex items-center justify-center before:opacity-0 group-hover:before:opacity-100 before:absolute before:w-1/3 before:pb-[100%] before:rounded-full before:bg-[linear-gradient(90deg,_theme(colors.indigo.500/0)_0%,_theme(colors.indigo.500)_35%,_theme(colors.indigo.200)_50%,_theme(colors.indigo.500)_65%,_theme(colors.indigo.500/0)_100%)] before:animate-[spin_3s_linear_infinite]">
              <span className="relative whitespace-nowrap ">
                <span className="block px-6 py-4 rounded-full bg-gradient-to-r from-slate-200 to-slate-100 z-10 group-hover:opacity-0 transition-opacity duration-500 ease-in-out">
                  Quick Summarize
                </span>
                <span
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-900 to-slate-800 z-10 inline-flex items-center whitespace-nowrap overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500 before:bg-clip-text before:text-transparent before:bg-gradient-to-r before:from-indigo-500 before:to-indigo-300 after:bg-clip-text after:text-transparent after:bg-gradient-to-r after:from-indigo-500 after:to-indigo-300 before:content-['Drag_this_bookmark_for_instant_summaries'] after:content-['Drag_this_bookmark_for_instant_summaries'] before:px-2 after:px-2 before:animate-infinite-scroll after:animate-infinite-scroll"
                  aria-hidden="true"
                  onDragStart={handleDragStart}
                  draggable="true"
                  aria-label="Drag this to your bookmarks bar for quick summaries"
                ></span>
              </span>
            </span>

            <span className="group-hover:text-slate-300 transition-colors duration-500 ease-in-out">
              with smry.ai
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};