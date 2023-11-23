import {Card} from "./Card";

const cards: Card[] = [];
for (let i = 1; i <= 104; i++) {
  let point = 1
  if (i == 55) {
    point = 7
  } else if (i % 10 == 5) {
    point = 2
  } else if (i % 10 == 0) {
    point = 3
  } else if (i % 11 == 0) {
    point = 5
  }  else {
    point = 1
  }
  cards.push({
    id: i,
    bullPoints: point,
    image: `/images/cards/${i}.png`,
    value: i
  });
}

export default cards;