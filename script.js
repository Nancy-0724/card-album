const form = document.getElementById("cardForm");
const imageInput = document.getElementById("imageInput");
const cardList = document.getElementById("cardList");
const sortSelect = document.getElementById("sortSelect");
const filterCategory = document.getElementById("filterCategory");
const filterFavorite = document.getElementById("filterFavorite");
const loadingMsg = document.getElementById("loadingMsg");

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyNkqTqVgxcOle53DkMGFFivz21AGHSjumP9qSjhayqjRhN3T22-dL0_YxXWLZVRe0/exec";

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
    category: document.getElementById("categoryInput").value
      .split(",")
      .map(t => t.trim())
      .filter(Boolean),
    imageUrl,
    isFavorite: false
  };

  await sendToServer("saveCard", card);
  await renderCards();
  form.reset();
  loadingMsg.style.display = "none";
});

async function renderCards() {
  cardList.innerHTML = "";
  let cards = await fetchCards();

  const currentCategory = filterCategory.value;
  const onlyFavorite = filterFavorite.checked;

  // 先根據目前選擇的分類與是否收藏過濾卡片
  if (currentCategory) {
    cards = cards.filter(c => (c.category || []).includes(currentCategory));
  }

  if (onlyFavorite) {
    cards = cards.filter(c => c.isFavorite);
  }

  // 計算分類數量，用於產生分類下拉選單
  const categoryCount = {};
  cards.forEach(c => {
    const tags = c.category || [];
    tags.forEach(tag => {
      categoryCount[tag] = (categoryCount[tag] || 0) + 1;
    });
  });

  const uniqueCategories = Object.keys(categoryCount);
  filterCategory.innerHTML = `<option value="">全部分類</option>` +
    uniqueCategories.map(cat =>
      `<option value="${cat}">${cat} (${categoryCount[cat]})</option>`
    ).join("");

  filterCategory.value = currentCategory;

  // 排序邏輯
  const sort = sortSelect.value;
  if (sort === "price-asc") cards.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") cards.sort((a, b) => b.price - a.price);
  if (sort === "date-asc") cards.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sort === "date-desc") cards.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sort === "title-asc") cards.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "title-desc") cards.sort((a, b) => b.title.localeCompare(a.title));

  // 顯示統計資訊
  const totalCards = cards.length;
  const totalPrice = cards.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
  const summaryDiv = document.getElementById("summary");
  if (summaryDiv) {
    summaryDiv.textContent = `共 ${totalCards} 張卡片，總金額：${totalPrice} 元`;
  }

  // 渲染卡片（這段維持不變）
  for (const card of cards) {
    const div = document.createElement("div");
    div.className = "card";

    const img = document.createElement("img");
    img.src = card.imageUrl;
    img.alt = "小卡圖片";
    img.referrerPolicy = "no-referrer";
    img.onerror = function () {
      this.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/100px-No_image_available.svg.png";
    };

    const info = document.createElement("div");
    info.className = "card-info";

    const title = document.createElement("strong");
    title.textContent = card.title + (card.isFavorite ? " ⭐" : "");

    const metaDate = document.createElement("small");
    metaDate.textContent = `日期：${formatDateToLocalYMD(card.date)}`;

    const metaPrice = document.createElement("small");
    metaPrice.textContent = `價格：${card.price} 元`;

    const note = document.createElement("p");
    note.innerHTML = (card.note || "").replace(/\n/g, "<br>");

    (card.category || []).forEach(cat => {
      const tag = document.createElement("small");
      tag.textContent = cat;
      tag.className = "category-label";
      tag.style.backgroundColor = getColorForCategory(cat);
      info.appendChild(tag);
    });

    info.appendChild(title);
    info.appendChild(document.createElement("br"));
    info.appendChild(metaDate);
    info.appendChild(document.createElement("br"));
    info.appendChild(metaPrice);
    info.appendChild(document.createElement("br"));
    info.appendChild(note);

    const buttonGroup = document.createElement("div");
    buttonGroup.className = "button-group";

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
      const categoryInput = createInput("text", (card.category || []).join(", "));
      const noteInput = document.createElement("textarea");
      noteInput.rows = 3;
      noteInput.value = card.note;

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "儲存";
      saveBtn.onclick = async () => {
        card.title = titleInput.value;
        card.date = dateInput.value;
        card.price = Number(priceInput.value);
        card.category = categoryInput.value.split(",").map(t => t.trim()).filter(Boolean);
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
      info.appendChild(createLabeledField("標籤（逗號分隔）", categoryInput));
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

    buttonGroup.appendChild(favBtn);
    buttonGroup.appendChild(editBtn);
    buttonGroup.appendChild(delBtn);
    info.appendChild(buttonGroup);

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



// ✅ 綁定事件
sortSelect.addEventListener("change", renderCards);
filterCategory.addEventListener("change", renderCards);
filterFavorite.addEventListener("change", renderCards);

renderCards();
