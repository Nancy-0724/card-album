const form = document.getElementById("cardForm");
const imageInput = document.getElementById("imageInput");
const cardList = document.getElementById("cardList");
const sortSelect = document.getElementById("sortSelect");
const filterCategory = document.getElementById("filterCategory");
const loadingMsg = document.getElementById("loadingMsg");
const favoriteOnlyToggle = document.getElementById("favoriteOnlyToggle");


const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxuVzAwJflOs0GIJEm5_Gn3vg8m1PbjYB3NIeS00tixZ_xWGg4rA8pHneWUOe79HOA7OA/exec"; // ← 替換為你的 Apps Script 網址

async function uploadToDrive(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result;
      const formData = new URLSearchParams();
      formData.append("action", "upload");
      formData.append("image", base64Image);
      formData.append("filename", file.name);

      try {
        const res = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString()
        });
        const data = await res.json();
        resolve(data.success ? data.url : null);
      } catch (err) {
        alert("圖片上傳錯誤：" + err.message);
        resolve(null);
      }
    };
    reader.readAsDataURL(file);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = imageInput.files[0];
  if (!file) return alert("請選擇圖片");

  loadingMsg.style.display = "block";

  const imageUrl = await uploadToDrive(file);
  if (!imageUrl) {
    loadingMsg.style.display = "none";
    return;
  }

  const card = {
    id: Date.now().toString(),
    title: document.getElementById("titleInput").value,
    note: document.getElementById("noteInput").value,
    date: document.getElementById("dateInput").value,
    price: Number(document.getElementById("priceInput").value),
    category: document.getElementById("categoryInput").value || "未分類",
    imageUrl,
    isFavorite: false
  };

  await sendToServer("saveCard", card);
  await renderCards();
  form.reset();
  loadingMsg.style.display = "none";
});

async function sendToServer(action, data) {
  const formData = new URLSearchParams();
  formData.append("action", action);
  for (const key in data) {
    formData.append(key, data[key]);
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });
    return await res.json();
  } catch (err) {
    alert("伺服器錯誤：" + err.message);
    return { success: false };
  }
}

async function fetchCards() {
  try {
    const res = await fetch(APPS_SCRIPT_URL);
    return await res.json();
  } catch (err) {
    alert("讀取資料失敗：" + err.message);
    return [];
  }
}

function formatDateToLocalYMD(dateStr) {
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getColorForCategory(category) {
  const colors = [
    "#f44336", "#e91e63", "#9c27b0", "#3f51b5", "#2196f3",
    "#009688", "#4caf50", "#ff9800", "#795548", "#607d8b"
  ];
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

let allImageUrls = []; // 全部卡片圖片 URL
let currentIndex = 0;  // 目前顯示哪一張

async function renderCards() {
  cardList.innerHTML = "";
  let cards = await fetchCards();

  allImageUrls = cards.map(c => c.imageUrl);
  
  const currentCategory = filterCategory.value;

  // 分類計數
  const categoryCount = {};
  for (const c of cards) {
    const key = c.category || "未分類";
    categoryCount[key] = (categoryCount[key] || 0) + 1;
  }

  const uniqueCategories = Object.keys(categoryCount);
  filterCategory.innerHTML = `<option value="">全部分類</option>` +
    uniqueCategories.map(cat =>
      `<option value="${cat}">${cat} (${categoryCount[cat]})</option>`
    ).join("");

  filterCategory.value = currentCategory;

  if (currentCategory) {
    cards = cards.filter(c => (c.category || "未分類") === currentCategory);
  }

  if (favoriteOnlyToggle.checked) {
  cards = cards.filter(c => c.isFavorite);
}
//favoriteOnlyToggle.addEventListener("change", renderCards);

  
  const sort = sortSelect.value;
  if (sort === "price-asc") cards.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") cards.sort((a, b) => b.price - a.price);
  if (sort === "date-asc") cards.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sort === "date-desc") cards.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sort === "title-asc") cards.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "title-desc") cards.sort((a, b) => b.title.localeCompare(a.title));


  // ⬇️ 新增：總數量與總金額顯示區塊
  const totalCards = cards.length;
const totalPrice = cards.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
const avgPrice = totalCards > 0 ? (totalPrice / totalCards).toFixed(2) : 0;
const summaryDiv = document.getElementById("summary");
if (summaryDiv) {
  summaryDiv.textContent = `共 ${totalCards} 張卡，共 ${totalPrice} 元，均價 ${avgPrice} 元`;
}


  allImageUrls = cards.map(c => c.imageUrl); // 放在 renderCards 一開始（抓完 cards 後）

for (let i = 0; i < cards.length; i++) {
  const card = cards[i];
  const div = document.createElement("div");
  div.className = "card";

  const img = document.createElement("img");
  img.src = card.imageUrl;
  img.alt = "小卡圖片";
  img.referrerPolicy = "no-referrer";
  img.onerror = function () {
    this.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/100px-No_image_available.svg.png";
  };

  // 🔹 點擊圖片開啟大圖
  img.addEventListener("click", () => {
    currentIndex = i;
    openLightbox(card.imageUrl);
  });

  

    const info = document.createElement("div");
    info.className = "card-info";

    const title = document.createElement("strong");
    title.textContent = card.title + (card.isFavorite ? " ⭐" : "");

    const metaDate = document.createElement("small");
    metaDate.textContent = `日期：${formatDateToLocalYMD(card.date)}`;

    const metaPrice = document.createElement("small");
    metaPrice.textContent = `價格：${card.price} 元`;

    const categoryName = card.category || "未分類";
    const metaCategory = document.createElement("small");
    metaCategory.textContent = categoryName;
    metaCategory.className = "category-label";
    metaCategory.style.backgroundColor = getColorForCategory(categoryName);

    const note = document.createElement("p");
    note.innerHTML = String(card.note || "").replace(/\n/g, "<br>");



    const favBtn = document.createElement("button");
    favBtn.textContent = card.isFavorite ? "取消收藏" : "加入收藏";
    favBtn.onclick = async () => {
      await sendToServer("toggleFavorite", {
        id: card.id,
        isFavorite: (!card.isFavorite).toString()
      });
      await renderCards();
    };

    const editBtn = document.createElement("button");
    editBtn.textContent = "編輯";
    editBtn.onclick = () => {
      info.innerHTML = "";

      const titleInput = createInput("text", card.title);
      const dateInput = createInput("date", formatDateToLocalYMD(card.date));
      const priceInput = createInput("number", card.price);
      const categoryInput = createInput("text", card.category);
      const noteInput = document.createElement("textarea");
      noteInput.rows = 2;
      noteInput.value = card.note;

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "儲存";
      saveBtn.onclick = async () => {
        card.title = titleInput.value;
        card.date = dateInput.value;
        card.price = Number(priceInput.value);
        card.category = categoryInput.value || "未分類";
        card.note = noteInput.value;
        await sendToServer("updateCard", card);
        await renderCards();
      };

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "取消";
      cancelBtn.onclick = renderCards;

      info.appendChild(createLabeledField("標題", titleInput));
      info.appendChild(createLabeledField("日期", dateInput));
      info.appendChild(createLabeledField("價格", priceInput));
      info.appendChild(createLabeledField("分類", categoryInput));
      info.appendChild(createLabeledField("備註", noteInput));
      info.appendChild(saveBtn);
      info.appendChild(cancelBtn);
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "刪除";
    delBtn.onclick = async () => {
      if (confirm("確定要刪除這張卡片嗎？")) {
        await sendToServer("deleteCard", { id: card.id });
        await renderCards();
      }
    };

    info.appendChild(title);
    info.appendChild(document.createElement("br"));
    info.appendChild(metaDate);
    info.appendChild(document.createElement("br"));
    info.appendChild(metaPrice);
    info.appendChild(document.createElement("br"));
    info.appendChild(metaCategory);
    info.appendChild(note);
    info.appendChild(favBtn);
    info.appendChild(editBtn);
    info.appendChild(delBtn);

    div.appendChild(img);
    div.appendChild(info);
    cardList.appendChild(div);
  }
}

function createInput(type, value) {
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  return input;
}

function createLabeledField(labelText, inputElement) {
  const wrapper = document.createElement("div");
  wrapper.style.marginBottom = "8px";
  const label = document.createElement("label");
  label.textContent = labelText;
  label.style.display = "block";
  label.style.fontWeight = "bold";
  wrapper.appendChild(label);
  wrapper.appendChild(inputElement);
  return wrapper;
}

sortSelect.addEventListener("change", renderCards);
filterCategory.addEventListener("change", renderCards);
favoriteOnlyToggle.addEventListener("change", renderCards); // ← 移到這裡
renderCards();

function openLightbox(url) {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  lightboxImg.src = url;
  lightbox.style.display = "flex";
}

function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
}

function showPrevImage() {
  currentIndex = (currentIndex - 1 + allImageUrls.length) % allImageUrls.length;
  document.getElementById("lightbox-img").src = allImageUrls[currentIndex];
}

function showNextImage() {
  currentIndex = (currentIndex + 1) % allImageUrls.length;
  document.getElementById("lightbox-img").src = allImageUrls[currentIndex];
}

// 綁定燈箱事件
document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
document.getElementById("lightbox-prev").addEventListener("click", showPrevImage);
document.getElementById("lightbox-next").addEventListener("click", showNextImage);

// 按 Esc 關閉
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") showPrevImage();
  if (e.key === "ArrowRight") showNextImage();
});

// 點背景關閉
document.getElementById("lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") closeLightbox();
});
