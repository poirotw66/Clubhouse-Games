export function getCardImageUrl(cardId: string): string {
  return `${import.meta.env.BASE_URL}cards/${cardId}.jpg`;
}

export const CARD_BACK_IMAGE_URL = `${import.meta.env.BASE_URL}cards/back.jpg`;
