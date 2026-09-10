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

    // 초기 상태 셋팅
    stopCamera();
    $cameraPage.style.display = 'none';
    $imageSearchContainer.style.display = 'block'; // 이미지 검색 영역 보이기

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

        if (!query) {
            alert('검색어를 입력해주세요.');
            return;
        }

        $searchResultMessage.textContent = '검색 중입니다...';
        $bookList.innerHTML = '';

        try {
            const params = new URLSearchParams({ q: query });
            if (ddc !== "") { params.append('ddc', ddc); }

            const response = await fetch(`${API_BASE_URL}/api/books?${params.toString()}`);
            if (!response.ok) throw new Error('서버 응답 오류');

            const data = await response.json();

            if (data.total_count > 0) {
                $searchResultMessage.textContent = `총 ${data.total_count}권의 도서가 검색되었습니다.`;
                currentBooks = data.books; // 신규 데이터를 메모리에 저장
                renderBooks();             // 저장된 데이터를 기준으로 렌더링
            } else {
                currentBooks = [];
                $searchResultMessage.textContent = '검색 결과가 없습니다.';
            }
        } catch (error) {
            console.error('검색 오류:', error);
            $searchResultMessage.textContent = '검색 중 오류가 발생했습니다.';
        }
        if (data.total_count > 0) {
            $searchResultMessage.textContent = `총 ${data.total_count}권의 도서가 검색되었습니다.`;

            // API 검색 순서(정확도)를 보존하기 위해 originalIndex를 부여합니다.
            currentBooks = data.books.map((book, index) => ({
                ...book,
                originalIndex: index
            }));

            renderBooks();
        } else {
            currentBooks = [];
            $searchResultMessage.textContent = '검색 결과가 없습니다.';
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

            if (sortBy === 'accuracy') {
                // 정확도순: API 원본 검색 결과 순서(originalIndex) 기준
                comparison = a.originalIndex - b.originalIndex;
            } else if (sortBy === 'title') {
                // 1차: 제목, 2차: 청구기호
                comparison = (a.title || '').localeCompare(b.title || '', 'ko', { numeric: true });
                if (comparison === 0) {
                    const callA = a.callNo || a.call_no || a.classNo || '';
                    const callB = b.callNo || b.call_no || b.classNo || '';
                    comparison = compareCallNumbers(callA, callB);
                }
            } else if (sortBy === 'author') {
                comparison = (a.author || '').localeCompare(b.author || '', 'ko', { numeric: true });
            } else if (sortBy === 'ddc') {
                const callA = a.callNo || a.call_no || a.classNo || '';
                const callB = b.callNo || b.call_no || b.classNo || '';
                comparison = compareCallNumbers(callA, callB);
            }

            return isAsc ? comparison : -comparison;
        });

        // 화면 카드 그리기
        sortedBooks.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card';

            const coverSrc = book.coverUrl || book.cover || book.cover_url || 'https://via.placeholder.com/56x80?text=No+Image';

            card.innerHTML = `
            <img src="${coverSrc}" alt="${book.title || '도서'}" class="book-cover" onerror="this.src='https://via.placeholder.com/56x80?text=No+Image'" />
            <div class="book-info">
                <h3 class="book-title" title="${book.title || ''}">${book.title || '제목 없음'}</h3>
                <p class="book-author">저자: ${book.author || '저자 미상'}</p>
                <p class="book-publisher">출판사: ${book.publisher || book.pub || '정보 없음'}</p>
            <p class="book-callno"> ${book.callNo || book.call_no || '기호 없음'}</p>
            </div>
        `;
            $bookList.appendChild(card);
        });
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
        $searchResultMessage.textContent = '이미지를 분석하는 중입니다...';
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('-F', blob, 'scan_image.jpg');

            const apiResponse = await fetch(`${API_BASE_URL}/api/scan`, { method: 'POST', body: formData });

            if (!apiResponse.ok) throw new Error(`서버 응답 오류: ${apiResponse.status}`);

            const data = await apiResponse.json();
            console.log('스캔 결과:', data);

            if (data.found && data.book_info) {
                $searchResultMessage.textContent = `찾은 도서: ${data.book_info.title} (${data.book_info.author || '저자 미상'})`;
            } else {
                $searchResultMessage.textContent = data.message || '이미지에서 도서를 인식하지 못했습니다.';
            }

        } catch (error) {
            console.error('이미지 업로드/분석 오류:', error);
            $searchResultMessage.textContent = '스캔 처리 중 오류가 발생했습니다.';
        }
    }
});




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