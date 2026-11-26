document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------
    // 1. DOM 엘리먼트 초기화
    // --------------------------------------------------------
    const $video = document.getElementById('video');
    const $canvas = document.getElementById('canvas');
    const $photo = document.getElementById('photo');

    const $searchPage = document.getElementById('searchPage');
    const $settingsPage = document.getElementById('settingsPage');
    const $cameraPage = document.getElementById('cameraPage');

    const $searchInput = document.getElementById('searchInput');
    const $searchBtn = document.getElementById('searchBtn');
    const $imageSearchContainer = document.getElementById('imageSearchContainer');
    const $searchResultMessage = document.getElementById('searchResultMessage');
    const $scanResultLink = document.getElementById('scanResultLink');
    const $scanResultImage = document.getElementById('scanResultImage');

    const $ddcSelect = document.getElementById('ddcSelect');
    const $sortBySelect = document.getElementById('sortBySelect');
    const $sortOrderToggle = document.getElementById('sortOrderToggle');

    const $startCameraBtn = document.getElementById('startCameraBtn');
    const $settingsBtn = document.getElementById('settingsBtn');
    const $backBtn = document.getElementById('backBtn');
    const $closeCameraBtn = document.getElementById('closeCameraBtn');
    const $captureBtn = document.getElementById('captureBtn');
    const $retryBtn = document.getElementById('retryBtn');

    const $bookList = document.getElementById('bookList');
    let currentBooks = [];
    let currentQuery = '';
    let selectedBook = null; // 실제로 찾을(선택한) 도서. 선택 전에는 이미지 검색 버튼이 잠김

    // 초기 상태 셋팅
    stopCamera();
    $cameraPage.style.display = 'none';
    $imageSearchContainer.style.display = 'block'; // 이미지 검색 영역 보이기
    updateImageSearchLock();                       // 처음에는 선택된 책이 없으므로 잠금

    const API_BASE_URL = 'http://localhost:8000';

    // --------------------------------------------------------
    // 2. 화면 전환 이벤트
    // --------------------------------------------------------
    $settingsBtn.addEventListener('click', () => {
        $searchPage.classList.remove('active');
        $searchPage.style.display = 'none';
        $settingsPage.classList.add('active');
        $settingsPage.style.display = 'block';
        $settingsBtn.style.display = 'none';
    });

    $backBtn.addEventListener('click', () => {
        $settingsPage.classList.remove('active');
        $settingsPage.style.display = 'none';
        $searchPage.classList.add('active');
        $searchPage.style.display = 'block';
        $settingsBtn.style.display = 'flex';
    });

    // --------------------------------------------------------
    // 3. 필터/정렬 토글 로직
    // --------------------------------------------------------
    $sortOrderToggle.addEventListener('click', () => {
        const currentOrder = $sortOrderToggle.getAttribute('data-order');
        if (currentOrder === 'asc') {
            $sortOrderToggle.setAttribute('data-order', 'desc');
            $sortOrderToggle.textContent = '내림차순 ▼';
        } else {
            $sortOrderToggle.setAttribute('data-order', 'asc');
            $sortOrderToggle.textContent = '오름차순 ▲';
        }
        renderBooks();
    });

    $ddcSelect.addEventListener('change', () => {
        if ($searchInput.value.trim()) {
            executeSearch();
        }
    });

    $sortBySelect.addEventListener('change', () => {
        renderBooks();
    });

    // --------------------------------------------------------
    // 4. 텍스트 도서 검색 기능 (백엔드 연동)
    // --------------------------------------------------------
    async function executeSearch() {
        const query = $searchInput.value.trim();
        const ddc = $ddcSelect.value;

        currentQuery = query.replace(/\s+/g, '').toLowerCase();

        if (!query) {
            alert('검색어를 입력해주세요.');
            return;
        }

        $searchResultMessage.textContent = '검색 중입니다...';
        $bookList.innerHTML = '';
        clearSelection(); // 새로 검색하면 이전 선택을 해제하고 이미지 검색을 다시 잠금
        hideScanResultImage();

        try {
            const params = new URLSearchParams({ q: query });
            if (ddc !== "") { params.append('ddc', ddc); }

            const response = await fetch(`${API_BASE_URL}/api/books?${params.toString()}`);
            if (!response.ok) throw new Error('서버 응답 오류');

            const data = await response.json();

            if (data.total_count > 0) {
                $searchResultMessage.textContent = `총 ${data.total_count}권의 도서가 검색되었습니다. 찾을 책을 선택해 주세요.`;

                // API 검색 순서(정확도)를 보존하기 위해 originalIndex를 부여합니다.
                // (originalIndex는 정렬 후에도 각 책을 구분하는 선택 키로도 사용)
                currentBooks = data.books.map((book, index) => ({
                    ...book,
                    originalIndex: index
                }));
                renderBooks();
            } else {
                currentBooks = [];
                $searchResultMessage.textContent = '검색 결과가 없습니다.';
            }
        } catch (error) {
            console.error('검색 오류:', error);
            currentBooks = [];
            $searchResultMessage.textContent = '검색 중 오류가 발생했습니다.';
        }
    }

    $searchBtn.addEventListener('click', executeSearch);
    $searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });

    // --------------------------------------------------------
    // 5. 도서 목록 정렬 및 렌더링 함수
    // --------------------------------------------------------
    function renderBooks() {
        if (!$bookList) return;
        $bookList.innerHTML = '';

        if (!currentBooks || currentBooks.length === 0) return;

        const sortBy = $sortBySelect.value;
        const isAsc = $sortOrderToggle.getAttribute('data-order') === 'asc';

        const sortedBooks = [...currentBooks].sort((a, b) => {
            let comparison = 0;

            // 1. 1순위 기준 정렬
            if (sortBy === 'accuracy') {
                const diffA = getMinDifference(a, currentQuery);
                const diffB = getMinDifference(b, currentQuery);
                comparison = diffA - diffB;
            } else if (sortBy === 'title') {
                comparison = (a.title || '').localeCompare(b.title || '', 'ko', { numeric: true });
            } else if (sortBy === 'author') {
                comparison = (a.author || '').localeCompare(b.author || '', 'ko', { numeric: true });
            } else if (sortBy === 'ddc') {
                const callA = a.callNo || a.call_no || a.classNo || '';
                const callB = b.callNo || b.call_no || b.classNo || '';
                comparison = compareCallNumbers(callA, callB);
            }

            // 2. 2순위 (공통): 1순위 값이 완전히 같을 때(comparison === 0) 세부 청구기호로 비교
            // 단, 이미 ddc로 정렬한 경우는 다시 계산할 필요가 없으므로 제외
            if (comparison === 0 && sortBy !== 'ddc') {
                const callA = a.callNo || a.call_no || a.classNo || '';
                const callB = b.callNo || b.call_no || b.classNo || '';
                comparison = compareCallNumbers(callA, callB);
            }

            return isAsc ? comparison : -comparison;
        });

        // 화면 카드 그리기 (정렬이 바뀌어도 선택 상태는 유지)
        sortedBooks.forEach(book => {
            const card = document.createElement('div');
            const isSelected = isSameBook(book, selectedBook);
            card.className = isSelected ? 'book-card selected' : 'book-card';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-pressed', String(isSelected));

            const coverSrc = book.coverUrl || book.cover || book.cover_url || 'https://via.placeholder.com/56x80?text=No+Image';

            card.innerHTML = `
            <img src="${escapeHtml(coverSrc)}" alt="${escapeHtml(book.title || '도서')}" class="book-cover" onerror="this.src='https://via.placeholder.com/56x80?text=No+Image'" />
            <div class="book-info">
                <h3 class="book-title" title="${escapeHtml(book.title || '')}">${escapeHtml(book.title || '제목 없음')}</h3>
                <p class="book-author">저자: ${escapeHtml(book.author || '저자 미상')}</p>
                <p class="book-publisher">출판사: ${escapeHtml(book.publisher || book.pub || '정보 없음')}</p>
            <p class="book-callno"> ${escapeHtml(getCallNo(book) || '기호 없음')}</p>
            </div>
            <span class="book-select-badge">${isSelected ? '✓ 선택됨' : '선택'}</span>
        `;

            card.addEventListener('click', () => toggleSelectBook(book));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSelectBook(book);
                }
            });
            $bookList.appendChild(card);
        });
    }

    // --------------------------------------------------------
    // 5-1. 찾을 도서 선택 및 이미지 검색 버튼 잠금/해제
    // --------------------------------------------------------
    function getCallNo(book) {
        return (book && (book.callNo || book.call_no || book.classNo)) || '';
    }

    function isSameBook(a, b) {
        if (!a || !b) return false;
        return a.originalIndex === b.originalIndex;
    }

    function toggleSelectBook(book) {
        // 이미 선택한 책을 다시 누르면 선택 해제
        selectedBook = isSameBook(book, selectedBook) ? null : book;
        renderBooks();
        updateImageSearchLock();
    }

    function clearSelection() {
        selectedBook = null;
        updateImageSearchLock();
    }

    function updateImageSearchLock() {
        const locked = !selectedBook;
        $startCameraBtn.disabled = locked;
        $startCameraBtn.title = locked ? '찾을 책을 먼저 선택해 주세요.' : '';
    }

    // --------------------------------------------------------
    // 5-2. 하이라이트 결과 사진 표시/숨김
    // --------------------------------------------------------
    function showScanResultImage(imageUrl) {
        if (!imageUrl) {
            hideScanResultImage();
            return;
        }
        // image_url은 '/scans/xxx.jpg' 형태의 상대 경로이므로 API 서버 주소를 붙임
        const src = new URL(imageUrl, API_BASE_URL).href;
        $scanResultImage.src = src;
        $scanResultLink.href = src; // 사진을 누르면 원본 크기로 열기
        $scanResultLink.hidden = false;
    }

    function hideScanResultImage() {
        $scanResultLink.hidden = true;
        $scanResultImage.removeAttribute('src');
        $scanResultLink.removeAttribute('href');
    }







    // --------------------------------------------------------
    // 6. 카메라 제어 (비율 및 해상도 최적화)
    // --------------------------------------------------------
    function stopCamera() {
        if ($video.srcObject) {
            $video.srcObject.getTracks().forEach(track => track.stop());
            $video.srcObject = null;
        }
    }

    async function connectCamera() {
        stopCamera();
        const isPortrait = window.innerHeight > window.innerWidth;
        let longSideRatio = isPortrait ? window.innerHeight / window.innerWidth : window.innerWidth / window.innerHeight;

        const MAX_RATIO = 16 / 9;
        if (longSideRatio > MAX_RATIO) longSideRatio = MAX_RATIO;

        const targetAspectRatio = isPortrait ? (1 / longSideRatio) : longSideRatio;
        const baseShortSide = 1080;
        const baseLongSide = Math.round(baseShortSide * longSideRatio);

        const targetWidth = isPortrait ? baseShortSide : baseLongSide;
        const targetHeight = isPortrait ? baseLongSide : baseShortSide;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: targetWidth },
                    height: { ideal: targetHeight },
                    aspectRatio: { ideal: targetAspectRatio }
                },
                audio: false,
            });

            $video.srcObject = stream;
            $video.style.display = 'block';
            $photo.style.display = 'none';
            $captureBtn.style.display = 'block';
            $retryBtn.style.display = 'none';

        } catch (error) {
            console.error('카메라 연동 실패:', error);
            alert('카메라 접근 권한이 필요하거나 기기에서 카메라를 지원하지 않습니다.');
        }

    }

    function openCameraFullscreen() {
        if (!selectedBook) { // 버튼이 잠겨 있어도 한 번 더 확인
            alert('검색 결과에서 찾을 책을 먼저 선택해 주세요.');
            return;
        }
        $cameraPage.style.display = 'flex'; // 가운데 정렬을 위해 flex 유지
        connectCamera();
    }

    function closeCameraFullscreen() {
        $cameraPage.style.display = 'none';
        stopCamera();
    }

    $startCameraBtn.addEventListener('click', openCameraFullscreen);
    $closeCameraBtn.addEventListener('click', closeCameraFullscreen);
    $retryBtn.addEventListener('click', connectCamera);

    // 화면 회전 시 카메라 해상도 재계산
    window.addEventListener('orientationchange', () => {
        if ($cameraPage.style.display === 'flex' || $cameraPage.style.display === 'block') {
            setTimeout(connectCamera, 300);
        }
    });

    // --------------------------------------------------------
    // 7. 이미지 캡처 및 서버 전송 기능 (/api/scan)
    // --------------------------------------------------------
    async function handleCapture() {
        const context = $canvas.getContext('2d');
        if (!context || !$video.videoWidth || !$video.videoHeight) return;

        // 실제 비디오 스트림의 원본 픽셀 해상도를 캔버스 크기로 설정
        $canvas.width = $video.videoWidth;
        $canvas.height = $video.videoHeight;

        // 비디오 프레임 그리기
        context.drawImage($video, 0, 0, $canvas.width, $canvas.height);

        // 이미지 변환 (JPG 포맷으로 용량/속도 최적화)
        const dataUrl = $canvas.toDataURL('image/jpeg', 0.8);
        $photo.src = dataUrl;

        $video.style.display = 'none';
        $photo.style.display = 'block';
        $captureBtn.style.display = 'none';
        $retryBtn.style.display = 'block';

        stopCamera();
        closeCameraFullscreen(); // 촬영 완료 후 카메라 창 닫기

        await uploadScannedImage(dataUrl);
    }

    $captureBtn.addEventListener('click', handleCapture);

    async function uploadScannedImage(dataUrl) {
        if (!selectedBook) {
            $searchResultMessage.textContent = '찾을 책이 선택되지 않았습니다.';
            return;
        }
        const target = selectedBook; // 분석 도중 선택이 바뀌어도 촬영 당시의 책으로 요청

        $searchResultMessage.textContent = `'${target.title}' 책을 사진에서 찾는 중입니다...`;
        hideScanResultImage();
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('file', blob, 'scan_image.jpg');

            // 선택한 도서 정보 → 백엔드 process_scan()의 target 인자로 전달됨
            formData.append('title', target.title || '');
            formData.append('author', target.author || '');
            formData.append('publisher', target.publisher || target.pub || '');
            formData.append('call_no', getCallNo(target));
            formData.append('reg_no', target.regNo || target.reg_no || '');

            const apiResponse = await fetch(`${API_BASE_URL}/api/scan`, { method: 'POST', body: formData });

            if (!apiResponse.ok) throw new Error(`서버 응답 오류: ${apiResponse.status}`);

            const data = await apiResponse.json();
            console.log('스캔 결과:', data);

            // 서버가 만든 하이라이트 사진을 버튼 아래에 표시
            showScanResultImage(data.image_url);

            if (data.found && data.book_info) {
                $searchResultMessage.textContent = `찾은 도서: ${data.book_info.title} (${data.book_info.author || '저자 미상'})`;
            } else if (data.message) {
                $searchResultMessage.textContent = data.message;
            } else {
                // 확실하지 않은 경우: 문구 없이 하이라이트 사진만 보여 줌
                $searchResultMessage.textContent = data.image_url ? '' : '이미지에서 도서를 인식하지 못했습니다.';
            }

        } catch (error) {
            console.error('이미지 업로드/분석 오류:', error);
            $searchResultMessage.textContent = '스캔 처리 중 오류가 발생했습니다.';
        }
    }
});




// 도서 정보에 <, ", ' 등이 들어 있어도 카드 HTML이 깨지지 않도록 이스케이프
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function compareCallNumbers(callNoA, callNoB) {
    const parseInfo = (str) => {
        const s = String(str || '').toLowerCase();

        // v.N 또는 vN 형태에서 숫자 추출 (권차)
        const vMatch = s.match(/v\.?\s*(\d+)/);
        // c.N 또는 cN 형태에서 숫자 추출 (복본)
        const cMatch = s.match(/c\.?\s*(\d+)/);

        // v.n 및 c.n 표기를 제거한 기본 청구기호 추출
        const base = s.replace(/v\.?\s*\d+/g, '').replace(/c\.?\s*\d+/g, '').trim();

        return {
            base: base,
            v: vMatch ? parseInt(vMatch[1], 10) : 0,
            c: cMatch ? parseInt(cMatch[1], 10) : 0
        };
    };

    const a = parseInfo(callNoA);
    const b = parseInfo(callNoB);

    // 1차 비교: 기본 청구기호/분류기호 (예: 813.6 세68)
    const baseCompare = a.base.localeCompare(b.base, 'ko', { numeric: true });
    if (baseCompare !== 0) return baseCompare;

    // 2차 비교: 권차 수치 비교 (v.1 < v.2 < v.10)
    if (a.v !== b.v) return a.v - b.v;

    // 3차 비교: 복본 수치 비교 (c.1 < c.2 < c.10)
    return a.c - b.c;
}

function getEditDistance(a, b) {
    if (!a) return b.length;
    if (!b) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // 삭제
                    matrix[i][j - 1] + 1,     // 삽입
                    matrix[i - 1][j] + 1      // 대체
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// 제목, 저자, 출판사 중 검색어와 가장 차이가 적은(가까운) 값을 반환
function getMinDifference(book, query) {
    if (!query) return 0;

    // 대상 문자열들도 띄어쓰기를 제거하고 소문자로 변환하여 비교
    const t = String(book.title || '').replace(/\s+/g, '').toLowerCase();
    const a = String(book.author || '').replace(/\s+/g, '').toLowerCase();
    const p = String(book.publisher || book.pub || '').replace(/\s+/g, '').toLowerCase();

    return Math.min(
        getEditDistance(t, query),
        getEditDistance(a, query),
        getEditDistance(p, query)
    );
}