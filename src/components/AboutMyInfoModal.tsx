import { Info, ChevronRight } from 'lucide-react';
import ModalShell from '@/components/ModalShell';

interface AboutMyInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QAItem {
  question: string;
  answer: string;
}

const qaItems: QAItem[] = [
  {
    question: '১ম প্রশ্ন: আমি কে?',
    answer: 'জন্ম সূত্রে রাশিয়া এবং অরেজিন হিসেবে বাংলাদেশি। এখন বাংলাদেশে আছি।',
  },
  {
    question: '২য় প্রশ্ন: আমি কি চাই/আমাদের গোল কি?',
    answer: 'আমি চাই বাংলাদেশে অনলাইন ক্যাসিনো বৈধ করতে। আমরা তার জন্য ইতিমধ্যে কাজ শুরু করেছি। আমরা সরকারের কাছে প্রস্তাব করেছি আমাদের ইনকামের ৯০% সমাজের কাজে লাগাতে। বাকি ১০% সাইটের রক্ষণাবেক্ষণ + প্রমোশনে ব্যয় করতে চাই।',
  },
  {
    question: '৩rd প্রশ্ন: অনলাইনে এতো সাইট থাকতে মানুষ কেন আমাদের সাইট ব্যবহার করবে?',
    answer: 'আমরা শুধু বেটিং সাইট হিসেবেই সীমাবদ্ধ থাকতে চাই না। আমাদের টোটাল ইনকামের ৪০% পাবে সমাজের অবহেলিত পথশিশু। আমাদের ইচ্ছা সমাজের পথশিশুদের নতুন ঠিকানা দিতে। আপনার আমার মতো স্বাভাবিক জীবনে ফেরত আনতে। যার সকল আপডেট পাবেন আমাদের ফেসবুক+টেলিগ্রামে।',
  },
  {
    question: '৪র্থ প্রশ্ন: আমাদের লক্ষ্য যদি মানুষ সেবা হয় তাহলে আমরা কেন হারাম পথ বেছে নিলাম?',
    answer: 'উত্তরটা জটিল কিন্তু এককথায় বলতে চাইলে আমরা মানুষকে সাহায্য করার জন্য কারো কাছে হাত পাততে চাই না।',
  },
];

export default function AboutMyInfoModal({ isOpen, onClose }: AboutMyInfoModalProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="About my Info"
      icon={<Info size={20} className="text-neon-blue" />}
    >
      <div className="space-y-3">
        {qaItems.map((item, i) => (
          <div
            key={i}
            className="bg-dark-card2 rounded-xl border border-dark-border p-4"
          >
            <div className="flex items-start gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-neon-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-neon-blue">{i + 1}</span>
              </div>
              <p className="text-sm font-bold text-white leading-snug">{item.question}</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed pl-9">{item.answer}</p>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
