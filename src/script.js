/* eslint-disable indent */
/* eslint-disable max-depth */
/* eslint-disable max-statements */
(function () {
    // dayjsのロケール設定
    dayjs.locale('ja');

    // コース毎の元気コストの設定
    const staminaCost = {
        _2m_live: 15,
        _2m_work: 15,
        _4m_live: 20,
        _4m_work: 20,
        _2p_live: 25,
        _2p_work: 25,
        _6m_live: 25,
        _6m_work: 25,
        _mm_live: 30,
        _mm_work: 30,
    };

    // コース毎の獲得ptの設定
    const points = {
        _2m_live: 35,
        _2m_work: 35 * 0.7,
        _4m_live: 49,
        _4m_work: 49 * 0.7,
        _2p_live: 62,
        _2p_work: 62 * 0.7,
        _6m_live: 64,
        _6m_work: 64 * 0.7,
        _mm_live: 85,
        _mm_work: 85 * 0.7,
    };

    // イベント楽曲の設定
    const consumedItemsPerEvent = 180;
    const earnPointsPerEvent = 537;
    const earnPointsPerBonusLive = 4000;

    // 入力値の取得
    function getFormValue() {
        const formValue = {};
        const errors = [];

        if ($('#isNow').prop('checked')) {
            $('#now').val(dayjs().format('YYYY-MM-DDTHH:mm'));
        }

        function validDateTime(field) {
            const inputValue = $(`#${field}`).val();
            if (!inputValue) {
                errors.push({
                    field: field,
                    message: '必須です。',
                });
            } else if (!dayjs(inputValue).isValid()) {
                errors.push({
                    field: field,
                    message: '日時の入力例は「2017-06-29T15:00」です。',
                });
            } else {
                formValue[field] = inputValue;
                formValue[`${field}Unix`] = dayjs(inputValue).unix();
            }
        }
        validDateTime('datetimeStart');
        validDateTime('datetimeEnd');
        validDateTime('now');

        if (formValue.nowUnix < formValue.datetimeStartUnix) {
            formValue.nowUnix = formValue.datetimeStartUnix;
            formValue.isFuture = true;
        }
        if (formValue.nowUnix > formValue.datetimeEndUnix) {
            formValue.nowUnix = formValue.datetimeEndUnix;
        }

        formValue.endOfTodayUnix = dayjs(formValue.now).endOf('d').unix();
        if (formValue.endOfTodayUnix < formValue.datetimeStartUnix) {
            formValue.endOfTodayUnix = formValue.datetimeStartUnix;
        }
        if (formValue.endOfTodayUnix > formValue.datetimeEndUnix) {
            formValue.endOfTodayUnix = formValue.datetimeEndUnix;
        }

        function validSafeInteger(field) {
            const inputValue = $(`#${field}`).val();
            if (!inputValue) {
                errors.push({
                    field: field,
                    message: '必須です。',
                });
            } else if (!Number.isSafeInteger(Number(inputValue))) {
                errors.push({
                    field: field,
                    message: '有効な値ではありません。',
                });
            } else {
                formValue[field] = Number(inputValue);
            }
        }
        validSafeInteger('targetEnd');
        validSafeInteger('stamina');
        validSafeInteger('liveTickets');
        validSafeInteger('ownPoints');
        validSafeInteger('ownItems');
        validSafeInteger('mission');
        validSafeInteger('ownDices');
        validSafeInteger('sugorokuRemaining');
        validSafeInteger('bonusLiveRemaining');
        formValue.eventBonus = (15 - formValue.bonusLiveRemaining) / 10;

        function validFiniteNumber(field) {
            const inputValue = $(`#${field}`).val();
            if (!inputValue) {
                errors.push({
                    field: field,
                    message: '必須です。',
                });
            } else if (!Number.isFinite(Number(inputValue))) {
                errors.push({
                    field: field,
                    message: '有効な値ではありません。',
                });
            } else {
                formValue[field] = Number(inputValue);
            }
        }
        validFiniteNumber('idolRemaining');

        formValue.workStaminaCost = Number(
            $('[name="workStaminaCost"]:checked').val()
        );
        formValue.staminaCostMultiplier = Number(
            $('[name="staminaCostMultiplier"]:checked').val()
        );
        formValue.ticketCostMultiplier = Number(
            $('#ticketCostMultiplier').val()
        );
        formValue.itemsCostMultiplier = Number(
            $('[name="itemsCostMultiplier"]:checked').val()
        );
        formValue.showCourse = $('[name="showCourse"]:checked')
            .map((i) => {
                return $('[name="showCourse"]:checked').eq(i).val();
            })
            .get();
        formValue.isAutoSave = $('#autoSave').prop('checked');
        formValue.inTable = {};
        formValue.inTable.workStaminaCost = {};
        formValue.inTable.staminaCostMultiplier = {};
        formValue.inTable.ticketCostMultiplier = {};
        formValue.inTable.itemsCostMultiplier = {};
        Object.keys(staminaCost).forEach((course) => {
            formValue.inTable.workStaminaCost[course] = Number(
                $(`[name="workStaminaCost${course}"]:checked`).val()
            );
            formValue.inTable.staminaCostMultiplier[course] = Number(
                $(`[name="staminaCostMultiplier${course}"]:checked`).val()
            );
            formValue.inTable.ticketCostMultiplier[course] = Number(
                $(`[name="ticketCostMultiplier${course}"]:checked`).val()
            );
            formValue.inTable.itemsCostMultiplier[course] = Number(
                $(`[name="itemsCostMultiplier${course}"]:checked`).val()
            );
        });

        $('.error').remove();
        if (errors.length) {
            errors.forEach((error) => {
                $(`#${error.field}`).after(
                    `<span class="error">${error.message}</span>`
                );
            });
            return null;
        }
        return formValue;
    }

    // 目標ポイントを計算
    function calculateTargetPoint(formValue) {
        let diffEnd = formValue.targetEnd - formValue.ownPoints;
        if (diffEnd < 0) {
            diffEnd = 0;
        }
        $('#diffEnd').text(`(あと ${diffEnd.toLocaleString()} pt)`);

        $('#labelToday').text(
            `${dayjs.unix(formValue.endOfTodayUnix).format('M/D')}の目標`
        );

        const targetToday = Math.round(
            (formValue.targetEnd *
                (formValue.endOfTodayUnix - formValue.datetimeStartUnix)) /
                (formValue.datetimeEndUnix - formValue.datetimeStartUnix)
        );
        let diffToday = targetToday - formValue.ownPoints;
        if (diffToday < 0) {
            diffToday = 0;
        }
        $('#targetToday').text(
            `${targetToday.toLocaleString()} pt (あと ${diffToday.toLocaleString()} pt)`
        );

        $('#labelNow').text(
            `${dayjs.unix(formValue.nowUnix).format('M/D H:mm')}の目標`
        );

        const targetNow = Math.round(
            (formValue.targetEnd *
                (formValue.nowUnix - formValue.datetimeStartUnix)) /
                (formValue.datetimeEndUnix - formValue.datetimeStartUnix)
        );
        let diffNow = targetNow - formValue.ownPoints;
        if (diffNow < 0) {
            diffNow = 0;
        }
        $('#targetNow').text(
            `${targetNow.toLocaleString()} pt (あと ${diffNow.toLocaleString()} pt)`
        );
    }

    // ログインボーナスを考慮
    function calculateLoginBonus(formValue) {
        const loginBonusPerDay = 540;
        let loginBonus =
            dayjs
                .unix(formValue.datetimeEndUnix)
                .endOf('d')
                .diff(dayjs.unix(formValue.nowUnix), 'd') * loginBonusPerDay;
        if (formValue.isFuture) {
            loginBonus += loginBonusPerDay;
        }
        $('#loginBonus').text(
            `+ ログインボーナス ${loginBonus.toLocaleString()} 個`
        );
        formValue.loginBonus = loginBonus;

        const loginBonusDicesPerDay = 2;
        let loginBonusDices =
            dayjs
                .unix(formValue.datetimeEndUnix)
                .endOf('d')
                .diff(dayjs.unix(formValue.nowUnix), 'd') *
            loginBonusDicesPerDay;
        if (formValue.isFuture) {
            loginBonusDices += loginBonusDicesPerDay;
        }
        $('#loginBonusDices').text(
            `+ ログインボーナス ${loginBonusDices.toLocaleString()} 個`
        );
        formValue.loginBonusDices = loginBonusDices;

        $('#eventBonus').text(
            `(pt獲得ボーナス ×${formValue.eventBonus.toFixed(1)})`
        );

        $('#expectedPoints').text(
            `(アイテム消費後 ${(
                formValue.ownPoints +
                Math.ceil(earnPointsPerEvent * formValue.eventBonus) *
                    Math.floor(formValue.ownItems / consumedItemsPerEvent)
            ).toLocaleString()} pt)`
        );
    }

    // コース毎の計算
    function calculateByCouse(course, formValue, result, minCost) {
        if (
            formValue.showCourse.length &&
            formValue.showCourse.indexOf(course) === -1
        ) {
            // 表示コースでなければ計算しない
            return;
        }

        const isWork = course.indexOf('work') !== -1;

        let ownItems = formValue.ownItems + formValue.loginBonus;
        let ownDices = formValue.ownDices;
        let sugorokuRemaining = formValue.sugorokuRemaining;
        let bonusLiveRemaining = formValue.bonusLiveRemaining;
        let eventBonus = formValue.eventBonus;

        let liveTimes = 0;
        let consumedStamina = 0;
        let liveEarnedPoints = 0;
        let eventTimes = 0;
        let consumedItems = 0;
        let eventEarnedPoints = 0;
        let moveSteps = 0;

        // アイドルトーキング達成までに必要なマスを計算
        // 残りトークは残り人数の5倍
        // エリア39マスのうちトークマスは13なので、必要マスはトークマスの平均3倍
        const sugorokuTarget = formValue.idolRemaining * 5 * 3;

        // 通常楽曲回数、イベント楽曲回数を計算
        while (
            formValue.targetEnd >
                formValue.ownPoints + liveEarnedPoints + eventEarnedPoints ||
            formValue.mission > eventTimes ||
            sugorokuTarget > moveSteps
        ) {
            // 累積ptが最終目標pt以上になるか、イベント楽曲回数がミッション以上になるまで繰り返し
            if (ownDices >= 1) {
                // サイコロを所持している場合、ミリオンすごろく
                ownDices--;
                if (sugorokuRemaining < 3.5) {
                    moveSteps += sugorokuRemaining;
                    sugorokuRemaining -= sugorokuRemaining;
                } else {
                    moveSteps += 3.5;
                    sugorokuRemaining -= 3.5; // 期待値(1～6の平均値)
                }
                if (sugorokuRemaining <= 0) {
                    // ゴールした場合
                    if (bonusLiveRemaining >= 1) {
                        // ボーナスライブが残っている場合、ボーナスライブ
                        bonusLiveRemaining--;
                        eventTimes++;
                        consumedItems += consumedItemsPerEvent;
                        eventEarnedPoints +=
                            Math.ceil(earnPointsPerEvent * eventBonus) +
                            earnPointsPerBonusLive;
                        ownDices += 5;
                        eventBonus = (15 - bonusLiveRemaining) / 10;
                    }
                    // スタートに戻る
                    sugorokuRemaining = 39;
                }
            } else if (ownItems >= consumedItemsPerEvent) {
                // アイテムを所持している場合、イベント楽曲
                ownItems -= consumedItemsPerEvent;
                eventTimes++;
                consumedItems += consumedItemsPerEvent;
                eventEarnedPoints += Math.ceil(earnPointsPerEvent * eventBonus);
                ownDices += 5;
            } else {
                // アイテムを所持していない場合、ライブ
                liveTimes++;
                consumedStamina += staminaCost[course];
                liveEarnedPoints += Math.ceil(points[course] * eventBonus);
                ownItems += Math.ceil(points[course]);
                ownDices += 4;
            }
        }

        // すごろくを考慮した通常楽曲回数を計算
        function calculateLiveTimesForSugoroku() {
            const maxCostMultiplier = isWork
                ? formValue.ticketCostMultiplier
                : formValue.staminaCostMultiplier;
            const maxTimesOf10 =
                maxCostMultiplier >= 10 ? Math.floor(liveTimes / 10) : 0;
            for (let timesOf10 = maxTimesOf10; timesOf10 >= 0; timesOf10--) {
                const maxTimesOf9 =
                    maxCostMultiplier >= 9
                        ? Math.floor((liveTimes - timesOf10 * 10) / 9)
                        : 0;
                for (let timesOf9 = maxTimesOf9; timesOf9 >= 0; timesOf9--) {
                    const maxTimesOf8 =
                        maxCostMultiplier >= 8
                            ? Math.floor(
                                  (liveTimes - timesOf10 * 10 - timesOf9 * 9) /
                                      8
                              )
                            : 0;
                    for (
                        let timesOf8 = maxTimesOf8;
                        timesOf8 >= 0;
                        timesOf8--
                    ) {
                        const maxTimesOf7 =
                            maxCostMultiplier >= 7
                                ? Math.floor(
                                      (liveTimes -
                                          timesOf10 * 10 -
                                          timesOf9 * 9 -
                                          timesOf8 * 8) /
                                          7
                                  )
                                : 0;
                        for (
                            let timesOf7 = maxTimesOf7;
                            timesOf7 >= 0;
                            timesOf7--
                        ) {
                            const maxTimesOf6 =
                                maxCostMultiplier >= 6
                                    ? Math.floor(
                                          (liveTimes -
                                              timesOf10 * 10 -
                                              timesOf9 * 9 -
                                              timesOf8 * 8 -
                                              timesOf7 * 7) /
                                              6
                                      )
                                    : 0;
                            for (
                                let timesOf6 = maxTimesOf6;
                                timesOf6 >= 0;
                                timesOf6--
                            ) {
                                const maxTimesOf5 =
                                    maxCostMultiplier >= 5
                                        ? Math.floor(
                                              (liveTimes -
                                                  timesOf10 * 10 -
                                                  timesOf9 * 9 -
                                                  timesOf8 * 8 -
                                                  timesOf7 * 7 -
                                                  timesOf6 * 6) /
                                                  5
                                          )
                                        : 0;
                                for (
                                    let timesOf5 = maxTimesOf5;
                                    timesOf5 >= 0;
                                    timesOf5--
                                ) {
                                    const maxTimesOf4 =
                                        maxCostMultiplier >= 4
                                            ? Math.floor(
                                                  (liveTimes -
                                                      timesOf10 * 10 -
                                                      timesOf9 * 9 -
                                                      timesOf8 * 8 -
                                                      timesOf7 * 7 -
                                                      timesOf6 * 6 -
                                                      timesOf5 * 5) /
                                                      4
                                              )
                                            : 0;
                                    for (
                                        let timesOf4 = maxTimesOf4;
                                        timesOf4 >= 0;
                                        timesOf4--
                                    ) {
                                        const maxTimesOf3 =
                                            maxCostMultiplier >= 3
                                                ? Math.floor(
                                                      (liveTimes -
                                                          timesOf10 * 10 -
                                                          timesOf9 * 9 -
                                                          timesOf8 * 8 -
                                                          timesOf7 * 7 -
                                                          timesOf6 * 6 -
                                                          timesOf5 * 5 -
                                                          timesOf4 * 4) /
                                                          3
                                                  )
                                                : 0;
                                        for (
                                            let timesOf3 = maxTimesOf3;
                                            timesOf3 >= 0;
                                            timesOf3--
                                        ) {
                                            const maxTimesOf2 =
                                                maxCostMultiplier >= 2
                                                    ? Math.floor(
                                                          (liveTimes -
                                                              timesOf10 * 10 -
                                                              timesOf9 * 9 -
                                                              timesOf8 * 8 -
                                                              timesOf7 * 7 -
                                                              timesOf6 * 6 -
                                                              timesOf5 * 5 -
                                                              timesOf4 * 4 -
                                                              timesOf3 * 3) /
                                                              2
                                                      )
                                                    : 0;
                                            for (
                                                let timesOf2 = maxTimesOf2;
                                                timesOf2 >= 0;
                                                timesOf2--
                                            ) {
                                                const timesOf1 =
                                                    liveTimes -
                                                    timesOf10 * 10 -
                                                    timesOf9 * 9 -
                                                    timesOf8 * 8 -
                                                    timesOf7 * 7 -
                                                    timesOf6 * 6 -
                                                    timesOf5 * 5 -
                                                    timesOf4 * 4 -
                                                    timesOf3 * 3 -
                                                    timesOf2 * 2;
                                                if (
                                                    sugorokuTarget <=
                                                    moveSteps -
                                                        liveTimes * 4 * 3.5 +
                                                        (timesOf1 +
                                                            timesOf2 +
                                                            timesOf3 +
                                                            timesOf4 +
                                                            timesOf5 +
                                                            timesOf6 +
                                                            timesOf7 +
                                                            timesOf8 +
                                                            timesOf9 +
                                                            timesOf10) *
                                                            4 *
                                                            3.5
                                                ) {
                                                    // 移動数から1倍での移動数を一旦引き、達成できる場合
                                                    moveSteps =
                                                        moveSteps -
                                                        liveTimes * 4 * 3.5 +
                                                        (timesOf1 +
                                                            timesOf2 +
                                                            timesOf3 +
                                                            timesOf4 +
                                                            timesOf5 +
                                                            timesOf6 +
                                                            timesOf7 +
                                                            timesOf8 +
                                                            timesOf9 +
                                                            timesOf10) *
                                                            4 *
                                                            3.5;
                                                    return {
                                                        1: timesOf1,
                                                        2: timesOf2,
                                                        3: timesOf3,
                                                        4: timesOf4,
                                                        5: timesOf5,
                                                        6: timesOf6,
                                                        7: timesOf7,
                                                        8: timesOf8,
                                                        9: timesOf9,
                                                        10: timesOf10,
                                                    };
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return {
                1: liveTimes,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                6: 0,
                7: 0,
                8: 0,
                9: 0,
                10: 0,
            };
        }
        const fixedLiveTimes = calculateLiveTimesForSugoroku();

        // ミッションを考慮したイベント楽曲回数を計算
        function calculateEventTimesForMission() {
            const maxTimesOf4 =
                formValue.itemsCostMultiplier >= 4
                    ? Math.floor(eventTimes / 4)
                    : 0;
            for (let timesOf4 = maxTimesOf4; timesOf4 >= 0; timesOf4--) {
                const maxTimesOf2 =
                    formValue.itemsCostMultiplier >= 2
                        ? Math.floor((eventTimes - timesOf4 * 4) / 2)
                        : 0;
                for (let timesOf2 = maxTimesOf2; timesOf2 >= 0; timesOf2--) {
                    const timesOf1 = eventTimes - timesOf4 * 4 - timesOf2 * 2;
                    if (
                        formValue.mission <= timesOf1 + timesOf2 + timesOf4 &&
                        sugorokuTarget <=
                            moveSteps -
                                eventTimes * 5 * 3.5 +
                                (timesOf1 + timesOf2 + timesOf4) * 5 * 3.5
                    ) {
                        // 合計がミッション回数以上なら達成可能
                        return {
                            1: timesOf1,
                            2: timesOf2,
                            4: timesOf4,
                        };
                    }
                }
            }
            return {
                1: eventTimes,
                2: 0,
                4: 0,
            };
        }
        const fixedEventTimes = calculateEventTimesForMission();

        // お仕事回数の計算
        function calculateWorkTimes() {
            if (!isWork) {
                return {
                    consumedStamina: consumedStamina,
                    20: 0,
                    25: 0,
                    30: 0,
                };
            }
            const workTimes = {
                consumedStamina:
                    Math.ceil(consumedStamina / formValue.workStaminaCost) *
                    formValue.workStaminaCost,
                20: 0,
                25: 0,
                30: 0,
            };
            workTimes[formValue.workStaminaCost] = Math.ceil(
                consumedStamina / formValue.workStaminaCost
            );
            const workStaminaCost = [20, 25, 30].filter(
                (cost) => cost !== formValue.workStaminaCost
            );
            const maxTimesOfSelected = Math.ceil(
                consumedStamina / formValue.workStaminaCost
            );
            for (
                let timesOfSelected = maxTimesOfSelected;
                timesOfSelected >= 0;
                timesOfSelected--
            ) {
                const maxTimesOf0 = Math.ceil(
                    (consumedStamina -
                        timesOfSelected * formValue.workStaminaCost) /
                        workStaminaCost[0]
                );
                for (let timesOf0 = maxTimesOf0; timesOf0 >= 0; timesOf0--) {
                    const maxTimesOf1 = Math.ceil(
                        (consumedStamina -
                            timesOfSelected * formValue.workStaminaCost -
                            timesOf0 * workStaminaCost[0]) /
                            workStaminaCost[1]
                    );
                    for (
                        let timesOf1 = maxTimesOf1;
                        timesOf1 >= 0;
                        timesOf1--
                    ) {
                        const earnedLiveTickets =
                            timesOfSelected * formValue.workStaminaCost +
                            timesOf0 * workStaminaCost[0] +
                            timesOf1 * workStaminaCost[1];
                        if (
                            earnedLiveTickets + formValue.liveTickets ===
                            consumedStamina
                        ) {
                            // チケット枚数が消費枚数と同じなら無駄ゼロ
                            workTimes.consumedStamina = earnedLiveTickets;
                            workTimes[formValue.workStaminaCost] =
                                timesOfSelected;
                            workTimes[workStaminaCost[0]] = timesOf0;
                            workTimes[workStaminaCost[1]] = timesOf1;
                            return workTimes;
                        }
                        if (
                            earnedLiveTickets + formValue.liveTickets <
                            consumedStamina
                        ) {
                            // チケット枚数が消費枚数未満なら達成不能
                            continue;
                        }
                        if (earnedLiveTickets < workTimes.consumedStamina) {
                            // チケット枚数が最小なら格納
                            workTimes.consumedStamina = earnedLiveTickets;
                            workTimes[formValue.workStaminaCost] =
                                timesOfSelected;
                            workTimes[workStaminaCost[0]] = timesOf0;
                            workTimes[workStaminaCost[1]] = timesOf1;
                        }
                    }
                }
            }
            return workTimes;
        }
        const fixedWorkTimes = calculateWorkTimes(consumedStamina);
        const consumedLiveTickets = consumedStamina;
        consumedStamina = fixedWorkTimes.consumedStamina;

        // 所要時間の計算
        function calculateRequiredMinutes() {
            // お仕事
            let requiredMinutes =
                0.5 *
                (Math.ceil(
                    fixedWorkTimes[20] / formValue.staminaCostMultiplier
                ) +
                    Math.ceil(
                        fixedWorkTimes[25] / formValue.staminaCostMultiplier
                    ) +
                    Math.ceil(
                        fixedWorkTimes[30] / formValue.staminaCostMultiplier
                    ));
            // 通常楽曲
            requiredMinutes +=
                3 *
                (fixedLiveTimes[1] +
                    fixedLiveTimes[2] +
                    fixedLiveTimes[3] +
                    fixedLiveTimes[4] +
                    fixedLiveTimes[5] +
                    fixedLiveTimes[6] +
                    fixedLiveTimes[7] +
                    fixedLiveTimes[8] +
                    fixedLiveTimes[9] +
                    fixedLiveTimes[10]);
            // イベント楽曲
            requiredMinutes +=
                3 *
                (fixedEventTimes[1] + fixedEventTimes[2] + fixedEventTimes[4]);
            return requiredMinutes;
        }
        const requiredMinutes = calculateRequiredMinutes();

        // 自然回復日時の計算
        const naturalRecoveryUnix = dayjs
            .unix(formValue.nowUnix)
            .add((consumedStamina - formValue.stamina) * 5, 'm')
            .unix();

        // 要回復元気の計算
        let requiredRecoveryStamina = 0;
        if (naturalRecoveryUnix > formValue.datetimeEndUnix) {
            requiredRecoveryStamina = Math.ceil(
                (naturalRecoveryUnix - formValue.datetimeEndUnix) / 60 / 5
            );
        }

        // 計算結果を格納
        result[course] = {};
        result[course].workTimes = fixedWorkTimes;
        result[course].liveTimes = fixedLiveTimes;
        result[course].consumedStamina = consumedStamina;
        result[course].naturalRecoveryUnix = naturalRecoveryUnix;
        result[course].requiredRecoveryStamina = requiredRecoveryStamina;
        result[course].consumedLiveTickets = consumedLiveTickets;
        result[course].liveEarnedPoints = liveEarnedPoints;

        result[course].eventTimes = fixedEventTimes;
        result[course].consumedItems = consumedItems;
        result[course].eventEarnedPoints = eventEarnedPoints;
        result[course].requiredMinutes = requiredMinutes;

        result[course].requiredTime = '';
        if (Math.floor(result[course].requiredMinutes / 60)) {
            result[course].requiredTime += `${Math.floor(
                result[course].requiredMinutes / 60
            )}時間`;
        }
        if (Math.ceil(result[course].requiredMinutes % 60)) {
            result[course].requiredTime += `${Math.ceil(
                result[course].requiredMinutes % 60
            )}分`;
        }
        if (!result[course].requiredTime) {
            result[course].requiredTime += '0分';
        }

        // 所要時間、要回復元気の最小値を格納
        if (
            minCost.requiredMinutes === undefined ||
            minCost.requiredMinutes > result[course].requiredMinutes
        ) {
            minCost.requiredMinutes = result[course].requiredMinutes;
        }
        if (
            minCost.requiredRecoveryStamina === undefined ||
            minCost.requiredRecoveryStamina >
                result[course].requiredRecoveryStamina
        ) {
            minCost.requiredRecoveryStamina =
                result[course].requiredRecoveryStamina;
        }
    }

    // 計算結果の表示
    function showResultByCouse(course, formValue, minResult, minCost) {
        if (
            formValue.showCourse.length &&
            formValue.showCourse.indexOf(course) === -1
        ) {
            // 表示コースでなければ列を非表示
            $(`.${course}`).hide();
            const level = course.slice(0, 3);
            const colspan = $(`.${level}`).prop('colspan');
            if (colspan > 1) {
                $(`.${level}`).prop('colspan', colspan - 1);
            } else {
                $(`.${level}`).hide();
            }
            return;
        }

        $(`.${course}`).show();

        const isWork = course.indexOf('work') !== -1;

        let workTimesHtml = '';
        [30, 25, 20]
            .filter((cost) => {
                return (
                    minResult[course].workTimes[cost] ||
                    cost === formValue.workStaminaCost
                );
            })
            .forEach((cost) => {
                if (workTimesHtml) {
                    workTimesHtml += '<br>';
                }
                let text = Math.floor(
                    minResult[course].workTimes[cost] /
                        formValue.staminaCostMultiplier
                ).toLocaleString();
                if (
                    minResult[course].workTimes[cost] %
                    formValue.staminaCostMultiplier
                ) {
                    text += `…${
                        minResult[course].workTimes[cost] %
                        formValue.staminaCostMultiplier
                    }`;
                }
                workTimesHtml +=
                    `<label for="workStaminaCost${course}-${cost}">` +
                    `<input type="radio"` +
                    ` name="workStaminaCost${course}"` +
                    ` id="workStaminaCost${course}-${cost}"` +
                    ` value="${cost}" />` +
                    ` [${cost}] ${text}` +
                    `</label>`;
            });

        let liveTimesHtml = '';
        [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
            .filter((multiplier) => {
                return (
                    minResult[course].liveTimes[multiplier] ||
                    (isWork && multiplier === formValue.ticketCostMultiplier) ||
                    (!isWork && multiplier === formValue.staminaCostMultiplier)
                );
            })
            .forEach((multiplier) => {
                if (liveTimesHtml) {
                    liveTimesHtml += '<br>';
                }
                if (isWork) {
                    liveTimesHtml +=
                        `<label for="ticketCostMultiplier${course}-${multiplier}">` +
                        `<input type="radio"` +
                        ` name="ticketCostMultiplier${course}"` +
                        ` id="ticketCostMultiplier${course}-${multiplier}"` +
                        ` value="${multiplier}" />` +
                        ` [×${multiplier}] ${minResult[course].liveTimes[
                            multiplier
                        ].toLocaleString()}` +
                        `</label>`;
                } else {
                    liveTimesHtml +=
                        `<label for="staminaCostMultiplier${course}-${multiplier}">` +
                        `<input type="radio"` +
                        ` name="staminaCostMultiplier${course}"` +
                        ` id="staminaCostMultiplier${course}-${multiplier}"` +
                        ` value="${multiplier}" />` +
                        ` [×${multiplier}] ${minResult[course].liveTimes[
                            multiplier
                        ].toLocaleString()}` +
                        `</label>`;
                }
            });

        let eventTimesHtml = '';
        [4, 2, 1]
            .filter((multiplier) => {
                return (
                    minResult[course].eventTimes[multiplier] ||
                    multiplier === formValue.itemsCostMultiplier
                );
            })
            .forEach((multiplier) => {
                if (eventTimesHtml) {
                    eventTimesHtml += '<br>';
                }
                eventTimesHtml +=
                    `<label for="itemsCostMultiplier${course}-${multiplier}">` +
                    `<input type="radio"` +
                    ` name="itemsCostMultiplier${course}"` +
                    ` id="itemsCostMultiplier${course}-${multiplier}"` +
                    ` value="${multiplier}" />` +
                    ` [×${multiplier}] ${minResult[course].eventTimes[
                        multiplier
                    ].toLocaleString()}` +
                    `</label>`;
            });

        function showResultText(field, minValue, unit, isLink) {
            let text = minValue;
            if (isLink) {
                text =
                    `<a href="../event-jewels-calculator/index.html?datetimeStart=${formValue.datetimeStart}&datetimeEnd=${formValue.datetimeEnd}&` +
                    `consumedStamina=${minResult[course].consumedStamina}&stamina=${formValue.stamina}">${minValue}</a>`;
            }
            if (unit) {
                text += ` ${unit}`;
            }
            $(`#${field}${course}`).html(text);
        }
        showResultText('workTimes', workTimesHtml);
        showResultText('liveTimes', liveTimesHtml);
        showResultText(
            'consumedStamina',
            minResult[course].consumedStamina.toLocaleString(),
            false,
            true
        );
        showResultText(
            'naturalRecoveryAt',
            dayjs.unix(minResult[course].naturalRecoveryUnix).format('M/D H:mm')
        );
        showResultText(
            'requiredRecoveryStamina',
            minResult[course].requiredRecoveryStamina.toLocaleString()
        );
        showResultText(
            'consumedLiveTickets',
            minResult[course].consumedLiveTickets.toLocaleString(),
            '枚'
        );
        showResultText(
            'liveEarnedPoints',
            minResult[course].liveEarnedPoints.toLocaleString(),
            'pt'
        );

        showResultText('eventTimes', eventTimesHtml);
        showResultText(
            'consumedItems',
            minResult[course].consumedItems.toLocaleString(),
            '個'
        );
        showResultText(
            'eventEarnedPoints',
            minResult[course].eventEarnedPoints.toLocaleString(),
            'pt'
        );

        showResultText('requiredTime', minResult[course].requiredTime);

        // 表中のラジオボタンに初期値セット
        const workStaminaCost =
            [formValue.workStaminaCost, 30, 25, 20].find((cost) => {
                return minResult[course].workTimes[cost];
            }) || formValue.workStaminaCost;
        $(`[name="workStaminaCost${course}"][value="${workStaminaCost}"]`).prop(
            'checked',
            true
        );
        const staminaCostMultiplier =
            [2, 1].find((multiplier) => {
                return minResult[course].liveTimes[multiplier];
            }) || formValue.staminaCostMultiplier;
        $(
            `[name="staminaCostMultiplier${course}"][value="${staminaCostMultiplier}"]`
        ).prop('checked', true);
        const ticketCostMultiplier =
            [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].find((multiplier) => {
                return minResult[course].liveTimes[multiplier];
            }) || formValue.ticketCostMultiplier;
        $(
            `[name="ticketCostMultiplier${course}"][value="${ticketCostMultiplier}"]`
        ).prop('checked', true);
        const itemsCostMultiplier =
            [4, 2, 1].find((multiplier) => {
                return minResult[course].eventTimes[multiplier];
            }) || formValue.itemsCostMultiplier;
        $(
            `[name="itemsCostMultiplier${course}"][value="${itemsCostMultiplier}"]`
        ).prop('checked', true);

        // 所要時間、要回復元気の最小値は青文字
        if (
            formValue.showCourse.length !== 1 &&
            minResult[course].requiredMinutes === minCost.requiredMinutes
        ) {
            $(`#requiredTime${course}`).addClass('info');
        } else {
            $(`#requiredTime${course}`).removeClass('info');
        }
        if (
            formValue.showCourse.length !== 1 &&
            minResult[course].requiredRecoveryStamina ===
                minCost.requiredRecoveryStamina
        ) {
            $(`#requiredRecoveryStamina${course}`).addClass('info');
        } else {
            $(`#requiredRecoveryStamina${course}`).removeClass('info');
        }

        // 開催期限をオーバーする場合、赤文字
        if (minResult[course].naturalRecoveryUnix > formValue.datetimeEndUnix) {
            $(`#naturalRecoveryAt${course}`).addClass('danger');
        } else {
            $(`#naturalRecoveryAt${course}`).removeClass('danger');
        }
        if (
            dayjs
                .unix(formValue.nowUnix)
                .add(minResult[course].requiredMinutes, 'm')
                .unix() > formValue.datetimeEndUnix
        ) {
            $(`#requiredTime${course}`).addClass('danger');
        } else {
            $(`#requiredTime${course}`).removeClass('danger');
        }
    }

    // トラストの計算
    function calculateTrust(formValue) {
        const minResult = {};
        const minCost = {};

        // 計算
        Object.keys(staminaCost).forEach((course) => {
            calculateByCouse(course, formValue, minResult, minCost);
        });

        // 表示
        $('._2m_header').prop('colspan', 2);
        $('._4m_header').prop('colspan', 2);
        $('._2p_header').prop('colspan', 2);
        $('._6m_header').prop('colspan', 2);
        $('._mm_header').prop('colspan', 2);
        $('._2m_header').show();
        $('._4m_header').show();
        $('._2p_header').show();
        $('._6m_header').show();
        $('._mm_header').show();
        Object.keys(staminaCost).forEach((course) => {
            showResultByCouse(course, formValue, minResult, minCost);
        });
    }

    function save() {
        const datetimeSave = dayjs().format('YYYY/M/D H:mm');

        const saveData = {
            datetimeStart: $('#datetimeStart').val(),
            datetimeEnd: $('#datetimeEnd').val(),
            targetEnd: $('#targetEnd').val(),
            now: $('#now').val(),
            isNow: $('#isNow').prop('checked'),
            stamina: $('#stamina').val(),
            liveTickets: $('#liveTickets').val(),
            ownPoints: $('#ownPoints').val(),
            ownItems: $('#ownItems').val(),
            mission: $('#mission').val(),
            ownDices: $('#ownDices').val(),
            sugorokuRemaining: $('#sugorokuRemaining').val(),
            idolRemaining: $('#idolRemaining').val(),
            bonusLiveRemaining: $('#bonusLiveRemaining').val(),
            workStaminaCost: $('[name="workStaminaCost"]:checked').val(),
            staminaCostMultiplier: $(
                '[name="staminaCostMultiplier"]:checked'
            ).val(),
            ticketCostMultiplier: $('#ticketCostMultiplier').val(),
            itemsCostMultiplier: $(
                '[name="itemsCostMultiplier"]:checked'
            ).val(),
            showCourse: $('[name="showCourse"]:checked')
                .map((i) => {
                    return $('[name="showCourse"]:checked').eq(i).val();
                })
                .get(),
            autoSave: $('#autoSave').prop('checked'),
            datetimeSave: datetimeSave,
        };

        localStorage.setItem(location.href, JSON.stringify(saveData));

        $('#datetimeSave').text(datetimeSave);
        $('#loadSave').prop('disabled', false);
        $('#clearSave').prop('disabled', false);
    }

    function calculate() {
        const formValue = getFormValue();
        calculateTargetPoint(formValue);
        calculateLoginBonus(formValue);
        calculateTrust(formValue);
        if (formValue.isAutoSave) {
            save();
        }
    }

    // input要素の変更時
    $('#datetimeStart').change(calculate);
    $('#datetimeEnd').change(calculate);
    $('#targetEnd').change(calculate);
    $('#now').change(() => {
        $('#isNow').prop('checked', true);
        if ($('#now').val() !== dayjs().format('YYYY-MM-DDTHH:mm')) {
            $('#isNow').prop('checked', false);
        }
        calculate();
    });
    $('#isNow').change(calculate);
    $('#stamina').change(calculate);
    $('#liveTickets').change(calculate);
    $('#ownItems').change(calculate);
    $('#ownPoints').change(calculate);
    $('#mission').change(calculate);
    $('#ownDices').change(calculate);
    $('#sugorokuRemaining').change(calculate);
    $('#idolRemaining').change(calculate);
    $('#bonusLiveRemaining').change(calculate);
    $('[name="workStaminaCost"]').change(calculate);
    $('[name="staminaCostMultiplier"]').change(calculate);
    $('#ticketCostMultiplier').change(calculate);
    $('[name="itemsCostMultiplier"]').change(calculate);
    $('[name="showCourse"]').change(() => {
        $('#showCourse-all').prop('checked', true);
        $('[name="showCourse"]').each((i) => {
            if (!$('[name="showCourse"]').eq(i).prop('checked')) {
                $('#showCourse-all').prop('checked', false);
            }
        });
        calculate();
    });
    $('#showCourse-all').change(() => {
        $('[name="showCourse"]').each((i) => {
            $('[name="showCourse"]')
                .eq(i)
                .prop('checked', $('#showCourse-all').prop('checked'));
        });
        calculate();
    });
    $('#update').click(calculate);
    $('#autoSave').change(calculate);

    // 回数増減ボタン
    $('.beforePlayWork').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(
            formValue.stamina +
                formValue.inTable.workStaminaCost[course] *
                    formValue.staminaCostMultiplier
        );
        $('#liveTickets').val(
            formValue.liveTickets -
                formValue.inTable.workStaminaCost[course] *
                    formValue.staminaCostMultiplier
        );

        calculate();
    });
    $('.afterPlayWork').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        if (
            formValue.liveTickets +
                formValue.inTable.workStaminaCost[course] *
                    formValue.staminaCostMultiplier >
            500
        ) {
            if (
                confirm(
                    `ライブチケットが${
                        formValue.liveTickets +
                        formValue.inTable.workStaminaCost[course] *
                            formValue.staminaCostMultiplier -
                        500
                    }枚超過します。\n超過分は加算されません。\n実行しますか？`
                )
            ) {
                $('#liveTickets').val(500);
            } else {
                return;
            }
        } else {
            $('#liveTickets').val(
                formValue.liveTickets +
                    formValue.inTable.workStaminaCost[course] *
                        formValue.staminaCostMultiplier
            );
        }

        $('#stamina').val(
            formValue.stamina -
                formValue.inTable.workStaminaCost[course] *
                    formValue.staminaCostMultiplier
        );

        calculate();
    });
    $('.beforePlayTicketLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTickets').val(
            formValue.liveTickets +
                staminaCost[course] *
                    formValue.inTable.ticketCostMultiplier[course]
        );
        $('#ownPoints').val(
            formValue.ownPoints -
                Math.ceil(
                    points[course] *
                        formValue.eventBonus *
                        formValue.inTable.ticketCostMultiplier[course]
                )
        );
        $('#ownItems').val(
            formValue.ownItems -
                Math.ceil(
                    points[course] *
                        formValue.inTable.ticketCostMultiplier[course]
                )
        );
        $('#ownDices').val(formValue.ownDices - 4);

        calculate();
    });
    $('.afterPlayTicketLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTickets').val(
            formValue.liveTickets -
                staminaCost[course] *
                    formValue.inTable.ticketCostMultiplier[course]
        );
        $('#ownPoints').val(
            formValue.ownPoints +
                Math.ceil(
                    points[course] *
                        formValue.eventBonus *
                        formValue.inTable.ticketCostMultiplier[course]
                )
        );
        $('#ownItems').val(
            formValue.ownItems +
                Math.ceil(
                    points[course] *
                        formValue.inTable.ticketCostMultiplier[course]
                )
        );
        $('#ownDices').val(formValue.ownDices + 4);

        calculate();
    });
    $('.beforePlayLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(
            formValue.stamina +
                staminaCost[course] *
                    formValue.inTable.staminaCostMultiplier[course]
        );
        $('#ownPoints').val(
            formValue.ownPoints -
                Math.ceil(
                    points[course] *
                        formValue.eventBonus *
                        formValue.inTable.staminaCostMultiplier[course]
                )
        );
        $('#ownItems').val(
            formValue.ownItems -
                points[course] * formValue.inTable.staminaCostMultiplier[course]
        );
        $('#ownDices').val(formValue.ownDices - 4);

        calculate();
    });
    $('.afterPlayLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(
            formValue.stamina -
                staminaCost[course] *
                    formValue.inTable.staminaCostMultiplier[course]
        );
        $('#ownPoints').val(
            formValue.ownPoints +
                Math.ceil(
                    points[course] *
                        formValue.eventBonus *
                        formValue.inTable.staminaCostMultiplier[course]
                )
        );
        $('#ownItems').val(
            formValue.ownItems +
                points[course] * formValue.inTable.staminaCostMultiplier[course]
        );
        $('#ownDices').val(formValue.ownDices + 4);

        calculate();
    });
    $('.beforePlayEvent').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#ownItems').val(
            formValue.ownItems +
                consumedItemsPerEvent *
                    formValue.inTable.itemsCostMultiplier[course]
        );
        $('#ownPoints').val(
            formValue.ownPoints -
                Math.ceil(
                    earnPointsPerEvent *
                        formValue.eventBonus *
                        formValue.inTable.itemsCostMultiplier[course]
                )
        );
        $('#ownDices').val(formValue.ownDices - 5);
        $('#mission').val(formValue.mission + 1);

        calculate();
    });
    $('.afterPlayEvent').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#ownItems').val(
            formValue.ownItems -
                consumedItemsPerEvent *
                    formValue.inTable.itemsCostMultiplier[course]
        );
        $('#ownPoints').val(
            formValue.ownPoints +
                Math.ceil(
                    earnPointsPerEvent *
                        formValue.eventBonus *
                        formValue.inTable.itemsCostMultiplier[course]
                )
        );
        $('#ownDices').val(formValue.ownDices + 5);
        $('#mission').val(formValue.mission - 1);

        calculate();
    });

    // サイコロボタン
    $('.goSugoroku').click(function () {
        // eslint-disable-next-line no-invalid-this
        const diceSpot = $(this).val();
        const formValue = getFormValue();

        if (formValue.sugorokuRemaining - diceSpot <= 0) {
            $('#sugorokuRemaining').val(39);
        } else {
            $('#sugorokuRemaining').val(formValue.sugorokuRemaining - diceSpot);
        }

        $('#ownDices').val(formValue.ownDices - 1);

        calculate();
    });

    // 保存ボタン
    $('#save').click(save);

    // 入力を初期化ボタン
    function defaultInput() {
        $('#datetimeStart').val(
            dayjs().subtract(15, 'h').format('YYYY-MM-DDT15:00')
        );
        $('#datetimeEnd').val(
            dayjs().subtract(15, 'h').add(1, 'w').format('YYYY-MM-DDT20:59')
        );
        $('#targetEnd').val(30000);
        $('#now').val(dayjs().format('YYYY-MM-DDTHH:mm'));
        $('#isNow').prop('checked', true);
        $('#stamina').val(0);
        $('#liveTickets').val(0);
        $('#ownPoints').val(0);
        $('#ownItems').val(0);
        $('#mission').val(30);
        $('#ownDices').val(0);
        $('#sugorokuRemaining').val(39);
        $('#idolRemaining').val(52);
        $('#bonusLiveRemaining').val(5);
        $('[name="workStaminaCost"][value="20"]').prop('checked', true);
        $('[name="staminaCostMultiplier"][value="1"]').prop('checked', true);
        $('#ticketCostMultiplier').val(10);
        $('[name="itemsCostMultiplier"][value="1"]').prop('checked', true);
        $('[name="showCourse"]').each((i) => {
            if (
                [
                    '_2m_live',
                    '_2m_work',
                    '_4m_live',
                    '_4m_work',
                    '_2p_live',
                    '_2p_work',
                    '_6m_live',
                    '_6m_work',
                    '_mm_live',
                    '_mm_work',
                ].indexOf($('[name="showCourse"]').eq(i).val()) !== -1
            ) {
                $('[name="showCourse"]').eq(i).prop('checked', true);
            } else {
                $('[name="showCourse"]').eq(i).prop('checked', false);
            }
        });
        $('#showCourse-all').prop('checked', true);
        $('#autoSave').prop('checked', false);

        calculate();
    }
    $('#clearInput').click(defaultInput);

    // 保存した値を読込ボタン
    function loadSavedData() {
        const savedString = localStorage.getItem(location.href);

        if (!savedString) {
            return false;
        }

        const savedData = JSON.parse(savedString);

        $('#datetimeStart').val(savedData.datetimeStart);
        $('#datetimeEnd').val(savedData.datetimeEnd);
        $('#targetEnd').val(savedData.targetEnd);
        $('#now').val(savedData.now);
        $('#isNow').prop('checked', savedData.isNow);
        $('#stamina').val(savedData.stamina);
        $('#liveTickets').val(savedData.liveTickets);
        $('#ownPoints').val(savedData.ownPoints);
        $('#ownItems').val(savedData.ownItems);
        $('#mission').val(savedData.mission);
        $('#ownDices').val(savedData.ownDices);
        $('#sugorokuRemaining').val(savedData.sugorokuRemaining);
        $('#idolRemaining').val(savedData.idolRemaining);
        $('#bonusLiveRemaining').val(savedData.bonusLiveRemaining);
        $(
            `[name="workStaminaCost"][value="${savedData.workStaminaCost}"]`
        ).prop('checked', true);
        $(
            `[name="staminaCostMultiplier"][value="${savedData.staminaCostMultiplier}"]`
        ).prop('checked', true);
        $('#ticketCostMultiplier').val(savedData.ticketCostMultiplier);
        $(
            `[name="itemsCostMultiplier"][value="${savedData.itemsCostMultiplier}"]`
        ).prop('checked', true);
        $('#showCourse-all').prop('checked', true);
        $('[name="showCourse"]').each((i) => {
            if (
                savedData.showCourse.indexOf(
                    $('[name="showCourse"]').eq(i).val()
                ) !== -1
            ) {
                $('[name="showCourse"]').eq(i).prop('checked', true);
            } else {
                $('[name="showCourse"]').eq(i).prop('checked', false);
                $('#showCourse-all').prop('checked', false);
            }
        });
        $('#autoSave').prop('checked', savedData.autoSave);

        calculate();

        $('#datetimeSave').text(savedData.datetimeSave);
        $('#loadSave').prop('disabled', false);
        $('#clearSave').prop('disabled', false);

        return true;
    }
    $('#loadSave').click(loadSavedData);

    // 保存した値を削除ボタン
    $('#clearSave').click(() => {
        localStorage.removeItem(location.href);

        $('#datetimeSave').text('削除済');
        $('#loadSave').prop('disabled', true);
        $('#clearSave').prop('disabled', true);
    });

    // 画面表示時に保存した値を読込、保存した値がなければ入力の初期化
    if (!loadSavedData()) {
        defaultInput();
    }
})();
