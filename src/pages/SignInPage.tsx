import { ChevronLeft, Gift, HelpCircle, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface SignInPageProps {
  onBack: () => void;
}

const REWARD_IMAGES = {
  money: 'https://i.postimg.cc/tTXtZCwn/IMG-20261103-192416.jpg',
  envelope: 'https://i.postimg.cc/QtXk9xwQ/IMG-20261103-192508.jpg',
  goldenEgg: 'https://i.postimg.cc/wv6cyTZc/IMG-20261103-192607.jpg',
};

const REWARDS = [
  { day: 1, amount: '5.00', note: '', image: REWARD_IMAGES.money },
  { day: 2, amount: '10.00', note: '', image: REWARD_IMAGES.money },
  { day: 3, amount: '20.00', note: '(5*-/) Red envelope', image: REWARD_IMAGES.envelope },
  { day: 4, amount: '20.00', note: '', image: REWARD_IMAGES.money },
  { day: 5, amount: '25.00', note: '', image: REWARD_IMAGES.money },
  { day: 6, amount: '30.00', note: '', image: REWARD_IMAGES.money },
  { day: 7, amount: '50.00', note: '20 GoldenEgg', image: REWARD_IMAGES.goldenEgg },
];

function RewardIllustration({ src, day }: { src: string; day: number }) {
  return <img src={src} alt={`Day ${day} reward`} className="h-[118px] w-full bg-[#fff8e5] object-contain" />;
}

export default function SignInPage({ onBack }: SignInPageProps) {
  const { user } = useAuth();
  const displayId = user?.phone || user?.name || user?.uid || '';

  return (
    <div className="min-h-screen bg-[#f7f7fa] text-[#555]">
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-center bg-[#155d61] shadow-sm">
        <button onClick={onBack} aria-label="Back" className="absolute left-5 text-[#ffc400] active:scale-90">
          <ChevronLeft size={34} strokeWidth={2.5} />
        </button>
        <h1 className="font-display text-[29px] font-bold text-[#ffc400]">Sign In</h1>
      </header>

      <section className="relative h-[305px] overflow-hidden bg-gradient-to-b from-[#ffcb43] via-[#ff9e54] to-[#f16a73]">
        <div className="absolute -left-10 top-20 h-40 w-40 rounded-full bg-[#ffe88a]/70" />
        <div className="absolute right-4 top-14 h-20 w-20 rounded-full bg-[#fff4a8]/75" />
        <div className="absolute right-[-20px] top-28 h-24 w-24 rounded-full bg-[#fff1a1]/75" />
        <div className="absolute bottom-[-80px] left-1/4 h-44 w-72 rounded-[50%] bg-[#ffc36e]/60" />
        <div className="relative flex items-center gap-6 px-14 pt-7">
          <div className="h-[136px] w-[136px] shrink-0 overflow-hidden rounded-full border-[8px] border-[#82d8f5] bg-white shadow-md">
            {user?.avatar ? <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" /> : <UserRound size={58} className="m-auto mt-8 text-gray-400" />}
          </div>
          <div className="min-w-0 text-white">
            <p className="truncate text-[25px] font-semibold tracking-wide">{displayId}</p>
            <p className="mt-3 text-[38px] font-bold leading-none">৳ 0.00</p>
          </div>
        </div>
      </section>

      <section className="relative -mt-1 rounded-t-[28px] bg-white px-5 pb-5 pt-5 shadow-sm">
        <div className="flex items-center justify-around text-center">
          <div className="w-1/2 border-r border-[#c9c9c9]">
            <p className="text-[39px] font-bold text-[#287fe5]">0</p>
            <p className="mt-2 text-[19px] text-[#aaa]">Last sign in</p>
          </div>
          <div className="w-1/2">
            <p className="text-[39px] font-bold text-[#f04d56]">0</p>
            <p className="mt-2 text-[19px] text-[#aaa]">Sign in total bonus</p>
          </div>
        </div>
      </section>

      <section className="mt-3 bg-white px-5 py-6">
        <h2 className="text-center font-display text-[27px] font-semibold text-[#1688cc]">নতুন সদস্য বৃদ্ধির পরিকল্পনা</h2>
        <div className="mt-7 flex items-center gap-4">
          <div className="flex h-14 w-16 items-center justify-center rounded-xl bg-[#ffe1e5] text-[#ed4a58] shadow-inner"><Gift size={42} /></div>
          <div>
            <h3 className="text-[23px] font-bold text-[#df304d]">নতুন সদস্য বৃদ্ধির পরিকল্পনা</h3>
            <p className="mt-1 flex items-center gap-2 text-[20px] text-[#72111e]">Not checked in today <HelpCircle size={21} fill="#8a0014" color="white" /></p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl bg-[#fff8ef] px-6 py-5 text-[21px] leading-tight text-[#666]">
          Minimum deposit<br />amount:<br /><span className="text-[25px] text-[#ef5260]">৳ 100.00</span>
        </div>
      </section>

      <section className="mt-3 bg-white px-5 pb-9 pt-8">
        <div className="grid grid-cols-3 gap-3">
          {REWARDS.map((reward) => (
            <article key={reward.day} className="overflow-hidden rounded-2xl border border-[#c9eee7] bg-white shadow-sm">
              <div className="bg-[#2b78e9] py-1 text-center text-[20px] font-semibold text-white">Day {reward.day}</div>
              <RewardIllustration src={reward.image} day={reward.day} />
              <div className="min-h-[78px] px-2 py-2 text-[16px] leading-6 text-[#4e4e4e]">
                <div className="flex justify-between gap-1"><span>Bonus</span><span>৳ {reward.amount}</span></div>
                {reward.note && <p>{reward.note}</p>}
              </div>
              <button className={`mx-2 mb-3 w-[calc(100%-16px)] rounded-full py-1 text-[18px] font-medium text-white ${reward.day === 1 ? 'bg-[#f04e43]' : 'bg-[#c8c9ca]'}`}>
                Sign In
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-5 pb-16 pt-2">
        <h2 className="text-[23px] font-semibold text-[#df4b43]">Sign-in rules</h2>
        <p className="mt-7 font-display text-[39px] font-bold leading-[1.18] text-[#0a8e22]">
          এই ইভেন্টের চক্র ৭ দিন, প্রতিদিন বিভিন্ন কাজের প্রয়োজনীয়তা সহ। লক্ষ্য হল নতুন সদস্যদের ইভেন্টটি কীভাবে কাজ করে তা বুঝতে সাহায্য করা এবং প্রতিদিন খেললে এবং সংগ্রহ করলে এমন মূল্যবান সদস্যদের জন্য আরও পুরস্কার সুবিধার দিকে কাজ করা।
        </p>
      </section>
    </div>
  );
}
