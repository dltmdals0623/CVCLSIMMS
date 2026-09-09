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
        $bookList.innerHTML = ''; // 이전 검색 결과 초기화

        try {
            const params = new URLSearchParams({ q: query });
            if (ddc !== "") { params.append('ddc', ddc); }

            const response = await fetch(`${API_BASE_URL}/api/books?${params.toString()}`);
            if (!response.ok) throw new Error('서버 응답 오류');

            const data = await response.json();

            if (data.total_count > 0) {
                $searchResultMessage.textContent = `총 ${data.total_count}권의 도서가 검색되었습니다.`;
                currentBooks = data.books; // 검색 결과 데이터 저장
                renderBooks();             // 카드 화면 렌더링 호출
            } else {
                currentBooks = [];
                $searchResultMessage.textContent = '검색 결과가 없습니다.';
            }
        } catch (error) {
            console.error('검색 오류:', error);
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
        $bookList.innerHTML = ''; // 기존 목록 초기화

        if (currentBooks.length === 0) return;

        const sortBy = $sortBySelect.value; // title | author | ddc
        const isAsc = $sortOrderToggle.getAttribute('data-order') === 'asc';

        // 1. 정렬 수행
        const sortedBooks = [...currentBooks].sort((a, b) => {
            let valA = '';
            let valB = '';

            if (sortBy === 'title') {
                valA = a.title || '';
                valB = b.title || '';
            } else if (sortBy === 'author') {
                valA = a.author || '';
                valB = b.author || '';
            } else if (sortBy === 'ddc') {
                valA = String(a.classNo || '');
                valB = String(b.classNo || '');
            }

            const comparison = valA.localeCompare(valB, 'ko', { numeric: true });
            return isAsc ? comparison : -comparison;
        });

        // 2. 카드 HTML 생성 및 추가
        sortedBooks.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card';

            // 이미지 URL fallback 처리 (기본 이미지)
            const coverSrc = book.coverUrl || book.cover || 'https://via.placeholder.com/70x100?text=No+Image';

            card.innerHTML = `
                <img src="${coverSrc}" alt="${book.title}" class="book-cover" onerror="this.src='https://via.placeholder.com/70x100?text=No+Image'" />
                <div class="book-info">
                    <h3 class="book-title" title="${book.title}">${book.title}</h3>
                    <p class="book-author">저자: ${book.author || '저자 미상'}</p>
                    <p class="book-ddc">십진분류: ${book.classNo ? book.classNo : '정보 없음'}</p>
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