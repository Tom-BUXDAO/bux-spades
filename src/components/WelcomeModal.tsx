import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { GiTwoCoins } from 'react-icons/gi';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-70" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-center mb-4">
                  <GiTwoCoins className="h-16 w-16 text-yellow-400 animate-bounce" />
                </div>
                <Dialog.Title
                  as="h3"
                  className="text-2xl font-bold leading-6 text-white text-center mb-4"
                >
                  Welcome to Spades!
                </Dialog.Title>
                <div className="mt-2">
                  <p className="text-lg text-gray-300 text-center">
                    Congratulations! You've received
                  </p>
                  <p className="text-3xl font-bold text-yellow-400 text-center my-4">
                    5,000,000 Coins
                  </p>
                  <p className="text-gray-300 text-center">
                    to start playing and enjoying the game!
                  </p>
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Let's Play!
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
} 